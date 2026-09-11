-- Restore the draw audit trail, and make it self-contained.
--
-- The three columns added by 20260813120000_draw_audit.sql — seed, ticket
-- and entry_total — were missing from the live database, so every draw
-- failed on insert. Without them "we drew it fairly" is a claim with no
-- evidence behind it, which was the entire argument for the seeded
-- selector in the first place.
--
-- Note on cause: applying the migration chain to an empty database leaves
-- all three columns present, so the chain does not drop them. The live
-- database diverged from the chain some other way. Every statement here
-- is `if not exists`, so this heals the database whether the columns are
-- missing, present, or partially present, and is safe to re-run.

alter table public.winners
  add column if not exists seed        text,
  add column if not exists ticket      int,
  add column if not exists entry_total int;

-- ---------------------------------------------------------------------
-- The pool, frozen at the moment of the draw
-- ---------------------------------------------------------------------
-- Reproducing a draw needs the seed AND the exact pool it ran against.
-- The selector sorts by spot id before walking, so the pool is a set of
-- ids, and nothing in the winners row recorded them — verification had to
-- go back to game_spots and trust that it had not changed since.
--
-- That is a weak audit trail: it asks the person checking the draw to
-- take the shop's current data on faith, which is exactly the thing being
-- questioned when somebody alleges a draw was rigged. Storing the pool
-- makes the winners row sufficient on its own.
alter table public.winners
  add column if not exists pool         jsonb,
  add column if not exists ticket_index int;

comment on column public.winners.seed is
  'Random seed handed to the deterministic selector. With pool, this reproduces the result.';
comment on column public.winners.pool is
  'The spots the draw ran against, frozen: [{"spot_id":…,"spot_number":…}, …] in the order the selector walked them (sorted by spot id). Re-running selectWinner over this with the seed must return ticket_index.';
comment on column public.winners.ticket_index is
  '1-based index the selector returned, into pool. The raw output of the algorithm.';
comment on column public.winners.ticket is
  'The WINNING SPOT NUMBER — what gets read aloud. This is pool[ticket_index-1].spot_number, not the index itself: the selector orders by spot id, so the index and the spot number are different numbers.';
comment on column public.winners.entry_total is
  'Spots in the pool at the moment of the draw. Frozen, unlike a live count.';

-- One winner per game. The draw is supposed to be unrepeatable, and
-- commitDraw returns the existing winner rather than drawing again — but
-- that check is a read followed by a write, which two simultaneous draws
-- can both pass. This makes the database the backstop.
create unique index if not exists winners_one_per_game_idx
  on public.winners (game_id);
