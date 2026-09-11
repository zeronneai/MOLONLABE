-- Bring a post-rebuild database to the current schema.
--
-- READ THIS FIRST: do NOT re-run the migration chain to fix a drifted
-- database. Nine of the fourteen migrations abort against a database that
-- is already migrated, because they transform a known previous state into
-- the next one — `alter table public.campaigns …` cannot work once
-- campaigns has been renamed to games, and `drop constraint if exists`
-- still needs its table to exist. You would get a partly-applied run and
-- no way to tell what took. Run this instead.
--
-- Everything here is idempotent. Every statement is `if not exists`,
-- `if exists`, or `create or replace`, so it is safe to run against a
-- database that already has some, all, or none of it, and safe to run
-- twice. It adds and it replaces; it never drops a column, never drops a
-- table, and never touches a row of data.
--
-- Afterwards, run scripts/check-schema.sql and confirm it returns nothing.

begin;

-- ---------------------------------------------------------------------
-- 1. The draw audit trail
-- ---------------------------------------------------------------------
-- Supersedes 20260813120000_draw_audit.sql. Without these the draw fails
-- on insert, and a draw that does land cannot be re-run and verified —
-- which is the property the whole seeded selector exists for.

alter table public.winners
  add column if not exists seed        text,
  add column if not exists ticket      int,
  add column if not exists entry_total int,
  add column if not exists pool         jsonb,
  add column if not exists ticket_index int;

comment on column public.winners.seed is
  'Random seed handed to the deterministic selector. With pool, this reproduces the result.';
comment on column public.winners.pool is
  'The spots the draw ran against, frozen: [{"spot_id":…,"spot_number":…}, …] in the order the selector walked them (sorted by spot id). Re-running selectWinner over this with the seed must return ticket_index.';
comment on column public.winners.ticket_index is
  '1-based index the selector returned, into pool. The raw output of the algorithm.';
comment on column public.winners.ticket is
  'The WINNING SPOT NUMBER — what gets read aloud. This is pool[ticket_index-1].spot_number, not the index itself.';
comment on column public.winners.entry_total is
  'Spots in the pool at the moment of the draw. Frozen, unlike a live count.';

-- One winner per game, enforced by the database rather than only by the
-- application's read-then-write, which two simultaneous draws can both
-- pass. Creating this fails if the table already holds two winners for
-- one game; if that happens, stop and call Purple Roots rather than
-- deleting a row to make it go through.
create unique index if not exists winners_one_per_game_idx
  on public.winners (game_id);

-- ---------------------------------------------------------------------
-- 2. The tail of the fixed-pool rebuild
-- ---------------------------------------------------------------------
-- The last section of 20260918100000_fixed_pool_games.sql. Included
-- because a migration applied by hand can stop partway, and this is the
-- part that would be missing if it did — the earlier sections create
-- tables and functions whose absence is obvious, while these are columns
-- and constraints whose absence only shows up at the till.

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

drop policy if exists "Anyone can read campaigns" on public.games;
drop policy if exists "Anyone can read games" on public.games;
create policy "Anyone can read games"
  on public.games for select
  to anon, authenticated
  using (true);

-- A policy left behind by the campaigns rename. Its condition is
-- `status = 'live'`, and no game is ever 'live' now — the states are
-- open, full and drawn. Harmless, but a policy that can never be true is
-- a trap for whoever reads this next.
drop policy if exists "Public can read live campaigns" on public.games;

commit;

-- ---------------------------------------------------------------------
-- What this deliberately does not do
-- ---------------------------------------------------------------------
-- It does not create checkout_attempts or the claim/finish/release
-- functions, and it does not create games, game_spots or the spot board.
-- Those come from 20260919100000_checkout_idempotency.sql and
-- 20260918100000_fixed_pool_games.sql, and both of those are safe to run
-- whole against a database that already has them.
--
-- If scripts/check-schema.sql reports a MISSING TABLE, run that table's
-- own migration in full. If it reports only MISSING COLUMN rows after
-- this script, something else has diverged — send the output rather than
-- writing ALTERs by hand.
