-- The entry program, rebuilt as fixed-pool games.
--
-- What changes, and why it is a rebuild rather than a migration: an entry
-- used to be a weightless token earned at a rate per dollar, or given
-- free. A spot is a finite, numbered, priced thing — one of N, sold once,
-- final. The two are not convertible in either direction, because no pool
-- and no per-spot price existed under the old model. Verified with the
-- client that campaigns, entrants, entries, orders-with-entries and
-- winners are all zero in production, so this drops the old model outright
-- rather than preserving something nobody holds.
--
-- A game has three states and no clock. It opens when it is created and
-- closes when the last spot sells; there is no date and no countdown.

-- ---------------------------------------------------------------------
-- 1. Out with the per-dollar model
-- ---------------------------------------------------------------------
-- add_purchase_entries was the only thing that could mint entries from an
-- ordinary sale. Ordinary merchandise now generates nothing at all.
drop function if exists public.add_purchase_entries(uuid, text, text, text, text, int);
drop function if exists public.entry_count(uuid);
drop function if exists public.entrant_count(uuid);

-- winners points at an entrant today; it will point at a spot below.
alter table public.winners drop constraint if exists winners_entrant_id_fkey;

drop table if exists public.entrants cascade;

alter table public.campaigns drop constraint if exists campaigns_entries_per_dollar_sane;
alter table public.campaigns drop column if exists entries_per_dollar;

alter table public.orders drop column if exists entries_per_dollar;
alter table public.orders drop column if exists entries_awarded;

-- ---------------------------------------------------------------------
-- 2. campaigns becomes games
-- ---------------------------------------------------------------------
-- "Campaign" stopped describing what this is. Everyone involved calls
-- them games, and code that disagrees with the room is a tax forever.
-- Foreign keys follow a rename automatically.
alter table public.campaigns rename to games;
alter table public.orders rename column campaign_id to game_id;
alter table public.winners rename column campaign_id to game_id;

-- No clock. The game closes when the last spot sells, not on a date.
alter table public.games drop column if exists opens_at;
alter table public.games drop column if exists closes_at;

alter table public.games
  add column if not exists total_spots integer not null default 0,
  add column if not exists spot_price_cents integer not null default 0;

alter table public.games drop constraint if exists games_spots_sane;
alter table public.games
  add constraint games_spots_sane
  check (total_spots >= 1 and total_spots <= 10000);

alter table public.games drop constraint if exists games_price_sane;
alter table public.games
  add constraint games_price_sane
  check (spot_price_cents >= 100 and spot_price_cents <= 100000000);

-- Three states, and only three. `open` the moment it exists, `full` when
-- the last spot sells, `drawn` once a winner is recorded.
alter table public.games drop constraint if exists games_status_valid;
alter table public.games
  add constraint games_status_valid
  check (status in ('open', 'full', 'drawn'));
alter table public.games alter column status set default 'open';

-- ---------------------------------------------------------------------
-- 3. Spots, created up front
-- ---------------------------------------------------------------------
/*
 * Every spot exists from the moment the game does, at status 'open'.
 *
 * The alternative — a counter on the game, with numbers handed out as
 * they sell — breaks the moment a claim is released after a failed
 * charge: the number it held is gone, the next buyer takes the number
 * after it, and "spot 37 of 50" stops being true forever. Rows make
 * spots-remaining a count, keep the numbering contiguous and stable, and
 * give every spot an identity that survives a declined card.
 *
 * Buyer details live here rather than being joined from the order,
 * because the board has to render without touching a table that holds
 * addresses and card details.
 */
create table if not exists public.game_spots (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  spot_number   integer not null,
  status        text not null default 'open',

  /* Set when sold. Null on an open spot. */
  order_id      uuid references public.orders(id) on delete set null,
  first_name    text,
  last_name     text,
  email         text,
  phone         text,

  /*
   * Whether this buyer agreed to appear on the public board.
   *
   * Default false, and the checkout checkbox is unchecked. These are
   * people buying spots in a firearms sweepstakes; publishing that
   * without being asked is a real exposure, and an opt-out would publish
   * everyone who did not notice the box.
   */
  show_name     boolean not null default false,

  held_at       timestamptz,
  sold_at       timestamptz,

  unique (game_id, spot_number)
);

alter table public.game_spots drop constraint if exists game_spots_status_valid;
alter table public.game_spots
  add constraint game_spots_status_valid
  check (status in ('open', 'held', 'sold'));

create index if not exists game_spots_game_status_idx
  on public.game_spots (game_id, status);
create index if not exists game_spots_order_idx
  on public.game_spots (order_id);
create index if not exists game_spots_email_idx
  on public.game_spots (game_id, lower(email));

alter table public.game_spots enable row level security;

-- No anon policy at all. The board reads through the view below, which
-- exposes a name only where the buyer asked for it and never an address.
drop policy if exists "Owner manages spots" on public.game_spots;
create policy "Owner manages spots"
  on public.game_spots for all
  to authenticated
  using (true)
  with check (true);

/*
 * What the public board is allowed to see.
 *
 * A view rather than a policy on the table, so the columns that must
 * never be public — email, phone, surname, order id — are not merely
 * filtered but absent. `display_name` is first name plus last initial,
 * the same redaction the draw already applies, and only for a buyer who
 * ticked the box.
 */
create or replace view public.game_spot_board
with (security_invoker = false) as
  select
    s.game_id,
    s.spot_number,
    s.status,
    case
      when s.status = 'sold' and s.show_name and s.first_name is not null
      then s.first_name ||
           case
             when coalesce(s.last_name, '') = '' then ''
             else ' ' || upper(left(s.last_name, 1)) || '.'
           end
      else null
    end as display_name
  from public.game_spots s;

grant select on public.game_spot_board to anon, authenticated;

-- Winners now point at the spot that won, not at an aggregated entrant.
alter table public.winners rename column entrant_id to spot_id;
alter table public.winners drop constraint if exists winners_spot_id_fkey;
alter table public.winners
  add constraint winners_spot_id_fkey
  foreign key (spot_id) references public.game_spots(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Claiming spots without selling the same one twice
-- ---------------------------------------------------------------------
/*
 * Claims the next `p_qty` open spots and returns their numbers, or null
 * if the game cannot supply that many.
 *
 * `for update skip locked` is the whole point. Two buyers going for the
 * last spot at the same instant both run this; the row lock means only
 * one of them sees it as open, and the other's subquery returns fewer
 * rows than it asked for, so its claim fails as a unit rather than
 * overselling. Without `skip locked` the second transaction would block
 * and then take a row the first had already taken.
 *
 * Called only with the service role, from the checkout, before the card
 * is charged — never from a browser.
 */
create or replace function public.claim_game_spots(p_game uuid, p_qty int)
returns int[]
language plpgsql
security definer
set search_path = public
as $$
declare
  taken int[];
begin
  if p_qty is null or p_qty <= 0 then
    return null;
  end if;

  -- Self-healing: a hold that never became a sale is an abandoned
  -- checkout — the server died between claiming and charging. Without
  -- this, every such crash would take a spot out of circulation
  -- permanently and the game could never fill.
  update public.game_spots
  set status = 'open', held_at = null
  where game_id = p_game
    and status = 'held'
    and held_at < now() - interval '15 minutes';

  with picked as (
    select id
    from public.game_spots
    where game_id = p_game and status = 'open'
    order by spot_number
    limit p_qty
    for update skip locked
  ),
  moved as (
    update public.game_spots s
    set status = 'held', held_at = now()
    from picked p
    where s.id = p.id
    returning s.spot_number
  )
  select array_agg(spot_number order by spot_number) into taken from moved;

  -- All or nothing. A partial claim is the oversell this function exists
  -- to prevent: it would hand somebody three of the four spots they are
  -- paying for. Put back whatever was taken and refuse.
  if taken is null or coalesce(array_length(taken, 1), 0) <> p_qty then
    if taken is not null then
      update public.game_spots
      set status = 'open', held_at = null
      where game_id = p_game
        and status = 'held'
        and spot_number = any(taken);
    end if;
    return null;
  end if;

  return taken;
end;
$$;

/*
 * Puts held spots back. Called when the charge fails, so the next buyer
 * can have them. Only ever moves 'held' rows — a sold spot is not
 * releasable by anything short of a person.
 */
create or replace function public.release_game_spots(p_game uuid, p_spots int[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.game_spots
  set status = 'open', held_at = null
  where game_id = p_game
    and status = 'held'
    and spot_number = any(p_spots);
$$;

/*
 * Turns held spots into sold ones and closes the game if that was the
 * last of them. One statement per concern, and the status flip is
 * derived from a count rather than from anything the caller passes, so a
 * miscounted caller cannot close a game early.
 */
create or replace function public.sell_game_spots(
  p_game       uuid,
  p_spots      int[],
  p_order      uuid,
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text,
  p_show_name  boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.game_spots
  set status = 'sold',
      sold_at = now(),
      order_id = p_order,
      first_name = p_first_name,
      last_name = p_last_name,
      email = p_email,
      phone = p_phone,
      show_name = coalesce(p_show_name, false)
  where game_id = p_game
    and status = 'held'
    and spot_number = any(p_spots);

  update public.games g
  set status = 'full'
  where g.id = p_game
    and g.status = 'open'
    and not exists (
      select 1 from public.game_spots
      where game_id = p_game and status <> 'sold'
    );
end;
$$;

revoke execute on function public.claim_game_spots(uuid, int) from anon, authenticated;
revoke execute on function public.release_game_spots(uuid, int[]) from anon, authenticated;
revoke execute on function public.sell_game_spots(uuid, int[], uuid, text, text, text, text, boolean) from anon, authenticated;

/*
 * The scoreboard, as one cheap read.
 *
 * Security definer so the public page gets the two numbers without the
 * spots table being readable. Counting rows rather than trusting a
 * denormalised counter means the number on screen cannot drift from the
 * number that decides whether a sale is possible.
 */
create or replace function public.game_spots_remaining(p_game uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.game_spots
  where game_id = p_game and status = 'open';
$$;

grant execute on function public.game_spots_remaining(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. A spot on an order
-- ---------------------------------------------------------------------
-- A spot is an ordinary taxable line. It is not shipped and it is not
-- collected, so it gets its own fulfillment value rather than borrowing
-- one and quietly attracting postage.
alter table public.order_items drop constraint if exists order_items_line_type_valid;
alter table public.order_items
  add constraint order_items_line_type_valid
  check (line_type in ('inventory', 'game_spot'));

alter table public.order_items
  add column if not exists game_id uuid references public.games(id) on delete set null,
  add column if not exists spot_numbers integer[];

alter table public.order_items drop constraint if exists order_items_fulfillment_valid;
alter table public.order_items
  add constraint order_items_fulfillment_valid
  check (fulfillment_type in ('ship', 'pickup', 'none'));

-- The game's own terms, accepted at checkout and stored the same way the
-- firearms disclaimer is: the timestamp is worthless without the words it
-- refers to, so both or neither.
alter table public.orders
  add column if not exists game_terms_accepted_at timestamptz,
  add column if not exists game_terms_text text;

-- ---------------------------------------------------------------------
-- 6. Public read of games
-- ---------------------------------------------------------------------
drop policy if exists "Anyone can read campaigns" on public.games;
drop policy if exists "Anyone can read games" on public.games;
create policy "Anyone can read games"
  on public.games for select
  to anon, authenticated
  using (true);

comment on column public.games.total_spots is
  'Fixed at creation. The spots rows are created with the game and the
   count never changes, so this and count(game_spots) always agree.';
comment on column public.game_spots.show_name is
  'Opt-in, unchecked at checkout. A spot is anonymous on the public board
   unless the buyer asked otherwise.';
