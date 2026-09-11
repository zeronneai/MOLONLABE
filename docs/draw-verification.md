# Verifying a draw

The seed shown on screen at the end of the draw is only worth something if
somebody can actually use it. This is the procedure. It needs no access to
the site, no cooperation from us, and — since the pool is recorded with the
result — no access to the shop's current data either.

## What gets recorded

Every draw writes one row to `public.winners`, and that row is sufficient
on its own:

| Column | Meaning |
| --- | --- |
| `seed` | 16 hex characters, generated at the moment of the draw |
| `pool` | The spots the draw ran against, frozen: `[{spot_id, spot_number}, …]` in the order the selector walked them |
| `ticket_index` | The 1-based index the selector returned, into `pool` |
| `ticket` | **The winning spot number** — the number read aloud. This is `pool[ticket_index - 1].spot_number` |
| `entry_total` | Spots in the pool at that moment — frozen, not a live count |
| `spot_id` | The spot that won |
| `drawn_at` | Timestamp |
| `display_name` | First name plus last initial. The surname is never stored here. |

### `ticket` and `ticket_index` are different numbers

This trips people up, so it is worth being explicit. The selector sorts
the pool by spot **id** — a uuid — and returns an index into that sorted
list. That index has nothing to do with the spot number a buyer paid for.
`ticket` is the spot number; `ticket_index` is the selector's raw output.
They coincide only by accident.

The reason `pool` is recorded at all is this: verification needs the exact
set of spot ids the draw ran against, and before this those ids existed
only in `game_spots`. Checking a draw therefore meant trusting that the
shop's current data had not changed since — which is precisely the thing
in question when somebody alleges a draw was rigged. The frozen pool
removes that dependency.

## The algorithm

`lib/draw/select.ts`, unchanged since the draw:

1. Sort every spot in the pool by `id`, ascending, as text.
   This is the step that makes the rest reproducible. Postgres does not
   promise row order without an `ORDER BY`, so without a fixed sort the
   same seed could walk the pool differently on a re-run and prove
   nothing.
2. Each sold spot is exactly one ticket. Somebody holding five spots
   appears five times and has five chances.
3. `total` is the number of spots in the pool.
4. Hash the seed with xmur3, feed it to mulberry32, take the first value,
   and compute `floor(value * total)`. That is the winning index, 0-based.
5. Walk the sorted list until the running cursor goes negative. That spot
   won, and its `spot_number` is the number announced.

Both xmur3 and mulberry32 are public-domain integer routines that produce
identical output in any language with 32-bit integer math. Nothing about
the result depends on our machine, our clock, or the time of day.

## Doing it yourself

Take the winners row. Nothing else is needed — not the game, not
`game_spots`, not the site.

```bash
WINNER='<paste the winners row as JSON>' node --experimental-strip-types \
  --input-type=module -e '
  import { verifyDraw } from "./lib/draw/select.ts";
  const w = JSON.parse(process.env.WINNER);
  console.log(verifyDraw({
    seed: w.seed,
    pool: w.pool,
    ticketIndex: w.ticket_index,
    ticket: w.ticket,
    total: w.entry_total,
  }));
'
```

`{ ok: true, spotNumber, spotId }` means the recorded draw stands: the
seed, run against the recorded pool by the rule above, produces exactly
the spot that was announced. Anything else prints the reason, and the
recorded draw does not stand.

`verifyDraw` is the same function `commitDraw` runs on itself before it
writes the row, so a draw that could not be reproduced is refused rather
than filed. To check the long way instead, call `selectWinner` on the
pool directly and compare its `entrantId` and `ticket` against the row's
`spot_id` and `ticket_index`.

## What this does and does not prove

It proves the winner follows from the seed and the recorded pool by a rule
fixed in advance, and that nobody re-rolled until they liked the answer:
a second draw would carry a different seed, and a game can only hold one
winner row — enforced by a unique index on `winners.game_id`, not only by
the application's check.

It does not prove the seed itself was unpredictable — it comes from the
server's CSPRNG, which you have to take on trust, or that the pool was
complete, i.e. that every spot sold is in it. If a campaign ever needs a stronger guarantee than that, the
usual answer is to publish a hash of the pool before the last spot sells
and draw the seed from a public source nobody controls. That is more
ceremony than a shop sweepstakes normally carries, and it is not what is
built today.

## The presentation cannot affect it

`commitDraw` writes the winner to the database before the animation starts.
The screen then animates toward a result that already exists. The reel
order, the tile sampling and the shuffle all use `Math.random`, which is a
deliberately different source from the seeded selector, so no visual
decision can reach the recorded outcome. The worst a broken animation can
do is fail to display a winner who is already recorded.
