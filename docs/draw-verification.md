# Verifying a draw

The seed shown on screen at the end of the draw is only worth something if
somebody can actually use it. This is the procedure. Anyone with the
campaign's entrant list can follow it — it needs no access to the site and
no cooperation from us.

## What gets recorded

Every draw writes one row to `public.winners`:

| Column | Meaning |
| --- | --- |
| `seed` | 16 hex characters, generated at the moment of the draw |
| `ticket` | The winning ticket, 1-based, within the weighted pot |
| `entry_total` | Total weighted entries at that moment — frozen, not a live count |
| `entrant_id` | The person who held that ticket |
| `drawn_at` | Timestamp |
| `display_name` | First name plus last initial. The surname is never stored here. |

The first three are what the presentation screen prints under the winner.

## The algorithm

`lib/draw/select.ts`, unchanged since the draw:

1. Sort every entrant in the campaign by `id`, ascending, as text.
   This is the step that makes the rest reproducible. Postgres does not
   promise row order without an `ORDER BY`, so without a fixed sort the
   same seed could walk the pool differently on a re-run and prove
   nothing.
2. Each entrant holds `max(1, floor(entry_count))` consecutive tickets, in
   that order. Someone with ten entries holds ten of the numbers. A free
   entry and a purchased entry are the same ticket.
3. `total` is the sum of all ticket counts.
4. Hash the seed with xmur3, feed it to mulberry32, take the first value,
   and compute `floor(value * total)`. That is the winning ticket, 0-based.
5. Walk the sorted list subtracting ticket counts until the running
   cursor goes negative. That entrant won.

Both xmur3 and mulberry32 are public-domain integer routines that produce
identical output in any language with 32-bit integer math. Nothing about
the result depends on our machine, our clock, or the time of day.

## Doing it yourself

Export the campaign's entrants (id and entry_count are the only columns
that matter), then:

```bash
node --input-type=module -e '
  import { selectWinner } from "./lib/draw/select.ts";
  const entrants = JSON.parse(process.env.ENTRANTS); // [{id, weight}, ...]
  console.log(selectWinner(entrants, process.env.SEED));
'
```

The `ticket` and `entrantId` it prints must match the recorded row. If
either differs, the recorded draw does not stand.

## What this does and does not prove

It proves the winner follows from the seed and the entrant list by a rule
fixed in advance, and that nobody re-rolled until they liked the answer:
a second draw would carry a different seed, and the campaign can only hold
one winner row.

It does not prove the seed itself was unpredictable — it comes from the
server's CSPRNG, which you have to take on trust, or that the entrant list
was complete. If a campaign ever needs a stronger guarantee than that, the
usual answer is to publish a hash of the entrant list before entries close
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
