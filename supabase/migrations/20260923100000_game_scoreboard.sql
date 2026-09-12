-- One place the sold count comes from, readable by the public.
--
-- Two faults are fixed here, and they are the same fault twice.
--
-- 1. THE PUBLIC COUNT WAS ALWAYS ZERO.
--    `game_spots` has row level security on and exactly one policy, which
--    is `to authenticated`. That is deliberate: the table carries buyer
--    names and email addresses, and the public reads the redacted
--    `game_spot_board` view instead. But the games list counted sold
--    spots from the TABLE using the anonymous key, and RLS answers an
--    unauthorised select with an empty set rather than an error. So the
--    query succeeded, returned nothing, and every game on the home page
--    and the games list read "0 / N" however many spots had sold.
--
--    Nothing errored, nothing logged, and the number was wrong in the
--    one place the whole game is about.
--
-- 2. THE COUNT FOR A FINISHED GAME WAS A LIVE QUERY.
--    "How many spots had sold" is a fact about a moment that has passed.
--    Recounting it on every page load means the number can move after
--    the draw — a refund, a correction, a schema change that gives
--    `status` a new value — and the page would then quietly disagree
--    with what was said on camera.
--
--    The frozen number already exists. `winners.entry_total` is written
--    by the draw and holds the pool size at the instant the winner was
--    picked, alongside the seed and the pool itself. It is not a new
--    thing to store, it is a thing already stored that the page was not
--    reading. So no column is added to `games` here: a second copy would
--    be a second thing that can disagree with the audit row, and the
--    audit row is the one that has to be right.
--
-- The view below is the single answer to "how many spots have sold",
-- for every surface. It is `security_invoker = false`, so it reads the
-- underlying table as its owner — the same device `game_spot_board`
-- already uses — and it exposes a count and nothing else. No name, no
-- email, no spot number. A count cannot leak a buyer.

create or replace view public.game_scoreboard
with (security_invoker = false) as
  select
    g.id                                as game_id,
    g.total_spots,
    -- A drawn game reports what was true at the draw. A live game is
    -- counted from the rows, because for a live game "now" is the
    -- question being asked.
    --
    -- coalesce falls through in order, which matters for the winner
    -- rows written before entry_total was restored: those have a null
    -- there, and falling through to the live count is better than
    -- reporting zero.
    coalesce(w.entry_total, c.sold, 0)::integer  as sold,
    -- Whether the number above is the frozen one. The admin shows the
    -- live count next to it when the two disagree, so a refund after a
    -- draw is visible rather than hidden by the freeze.
    (w.entry_total is not null)         as frozen,
    c.sold                              as sold_now
  from public.games g
  left join public.winners w
    on w.game_id = g.id
  left join lateral (
    select count(*)::integer as sold
    from public.game_spots s
    where s.game_id = g.id
      and s.status = 'sold'
  ) c on true;

comment on view public.game_scoreboard is
  'Sold count per game, for every surface including the anonymous one. Frozen to winners.entry_total once drawn. Exposes no buyer data — a count cannot identify anyone — so it is safe to grant to anon, which counting from game_spots is not.';

grant select on public.game_scoreboard to anon, authenticated;
