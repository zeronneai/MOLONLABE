-- No early draw, and what that makes necessary.
--
-- 1. A winner can only be recorded for a drop whose every guide is sold.
-- 2. A drop's guide count and price cannot change once it exists.
-- 3. Guides held by an abandoned checkout count as available again after
--    fifteen minutes, so the last guides of a drop cannot get stuck.
--
-- 1. NO EARLY DRAW
--
-- The client's rules say a drop runs until every guide is purchased, and
-- the checkout terms now say the same. Until this migration the admin
-- could draw a drop that had not sold out, after a confirmation, and
-- recorded that it had (winners.drawn_early, winners.unsold_spots).
--
-- That control is gone from the screens and from the server action. This
-- is the part that makes it a rule rather than a missing button: a
-- winner can only be recorded for a drop whose every guide is sold. It
-- holds for every role, the owner included, and for the service key,
-- because a manager running the site alone holds a real session token
-- and could otherwise write a winners row directly.
--
-- Changes no data. Existing winner rows are not touched or re-checked;
-- the trigger runs only when a winner is written. The drawn_early and
-- unsold_spots columns stay, as a record of any draw made before today.

begin;

create or replace function public.refuse_early_draw()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_sold  integer;
begin
  select total_spots into v_total from public.games where id = new.game_id;
  if v_total is null then
    raise exception 'There is no drop with id %.', new.game_id
      using errcode = 'P0001';
  end if;
  select count(*) into v_sold
    from public.game_spots
   where game_id = new.game_id and status = 'sold';
  if v_sold < v_total then
    raise exception 'This drop has % of % guides sold. A drop is drawn only once every guide is sold.',
      v_sold, v_total
      using errcode = 'P0001';
  end if;
  new.drawn_early := false;
  new.unsold_spots := 0;
  return new;
end;
$$;

revoke all on function public.refuse_early_draw() from public;

drop trigger if exists winners_refuse_early_draw on public.winners;
create trigger winners_refuse_early_draw
  before insert or update of game_id on public.winners
  for each row execute function public.refuse_early_draw();

-- 2. COUNT AND PRICE ARE FIXED
--
-- The rules say how many guides a drop offers and at what price is set
-- when it opens and does not change. The admin has never offered to edit
-- either after creation; this makes that true for a direct call as well.
-- Every existing drop keeps exactly the numbers it has.

create or replace function public.refuse_pool_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.total_spots is distinct from old.total_spots
     or new.spot_price_cents is distinct from old.spot_price_cents then
    raise exception 'A drop''s number of guides and price are fixed when it is created.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.refuse_pool_change() from public;

drop trigger if exists games_refuse_pool_change on public.games;
create trigger games_refuse_pool_change
  before update of total_spots, spot_price_cents on public.games
  for each row execute function public.refuse_pool_change();

-- 3. STALE HOLDS COUNT AS AVAILABLE
--
-- A guide is held while its buyer checks out, and a hold older than
-- fifteen minutes is an abandoned checkout. claim_game_spots releases
-- those, but only when somebody claims, and nobody could: this count
-- ignored them, so when the only guides left were stale holds the drop
-- read as sold out, the cart refused to sell them, and no claim ever ran
-- to free them. With early draws gone, that drop could never be drawn.
-- Counting stale holds as available lets the next buyer's claim release
-- and take them, which is what the fifteen minutes always meant.

create or replace function public.game_spots_remaining(p_game uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.game_spots
  where game_id = p_game
    and (status = 'open'
         or (status = 'held' and held_at < now() - interval '15 minutes'));
$$;

revoke execute on function public.game_spots_remaining(uuid) from public;
grant execute on function public.game_spots_remaining(uuid) to anon, authenticated;

commit;
