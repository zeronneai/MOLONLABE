-- The spot board and every name on it, removed.
--
-- The public game page now shows one thing: how many spots remain out of
-- the total. No grid, no names, no opt-in.
--
-- WHY THIS IS A REMOVAL AND NOT A SETTING
--
-- The opt-in worked — a spot was anonymous unless its buyer ticked a box
-- that was unticked by default, and the board read a view with no email
-- column on it at all. It was still the wrong shape. One buyer taking
-- forty spots in a hundred-spot game put one name across forty cells,
-- which is both a privacy problem nobody consented to in that form and a
-- game that looks decided before it is drawn. Leaving the mechanism in
-- place behind a flag would keep both failures one setting away.
--
-- So the column goes, the view goes, and the function stops taking the
-- argument. Nothing is left to switch back on by accident.
--
-- WHAT IS NOT REMOVED
--
-- `first_name`, `last_name`, `email` and `phone` on game_spots stay. They
-- are how the shop reaches a winner, which is the one thing the terms
-- promise about contact, and they were never public — the board read a
-- view precisely so that they could not be.
--
-- `winners.display_name` stays too. That is a different column on a
-- different table: one name, once, for a person who has won, redacted to
-- a first name and last initial. The problem here was repetition across a
-- grid, which a single winner does not have.

-- ---------------------------------------------------------------------
-- 1. The view
-- ---------------------------------------------------------------------
-- Dropped rather than rewritten without its name column. Its only reader
-- was the board, and a view nothing reads is a lever somebody eventually
-- pulls. Counts come from game_scoreboard, which exposes no spot-level
-- data at all.
drop view if exists public.game_spot_board;

-- ---------------------------------------------------------------------
-- 2. The function's argument
-- ---------------------------------------------------------------------
-- Dropped by its full signature first: changing a function's argument
-- list is a new function to Postgres, and CREATE OR REPLACE would leave
-- the old eight-argument version in place beside the new one. A stale
-- overload that still writes show_name is exactly the kind of thing that
-- survives a migration and surprises somebody later.
drop function if exists public.sell_game_spots(
  uuid, int[], uuid, text, text, text, text, boolean
);

create or replace function public.sell_game_spots(
  p_game       uuid,
  p_spots      int[],
  p_order      uuid,
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text
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
      phone = p_phone
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

-- Not callable from a browser. CREATE OR REPLACE resets privileges to the
-- default, so this is restated rather than assumed.
revoke execute on function public.sell_game_spots(uuid, int[], uuid, text, text, text, text)
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. The column
-- ---------------------------------------------------------------------
-- This drops data: which buyers had ticked the box. That record has no
-- remaining purpose — nothing will ever read it to decide whether to show
-- a name, because no name is ever shown — and keeping a column of
-- consent flags that nothing honours is worse for privacy than removing
-- it, not better.
alter table public.game_spots drop column if exists show_name;
