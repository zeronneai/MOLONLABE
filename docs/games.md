# Fixed-pool games

Replaces the per-dollar entry model entirely. An entry used to be a
weightless token earned by spending; a spot is a finite, numbered, priced
thing — one of N, sold once, final.

## How one works

The owner creates a game around one item and sets two numbers by hand:
how many spots, and what one costs. Neither is derived from the item's
price, because only a person knows what a spot in *this* prize is worth.

**Both are permanent.** Changing the count would orphan or invent spots
somebody already holds; changing the price would mean two buyers paid
differently for the same thing. The form states this before they are set
rather than refusing an edit afterwards.

Three states and no clock:

| | |
| --- | --- |
| `open` | From creation. There is no draft — the spots are laid out and it is on sale |
| `full` | The instant the last spot sells, set inside the same statement that sells it |
| `drawn` | Once a winner is recorded |

None of them is settable by hand. A status control that could contradict
the spot rows would be worse than no control.

## Spots are rows, created up front

All N exist from the moment the game does, at `status = 'open'`.

The alternative — a counter, with numbers handed out as they sell —
breaks the first time a claim is released after a failed charge: the
number it held is gone, the next buyer takes the one after it, and "spot
37 of 60" stops being true forever. Rows make spots-remaining a count,
keep the numbering contiguous, and give every spot an identity that
survives a declined card.

Cost is one row per spot. A 60-spot game is 60 rows.

## Concurrency

`claim_game_spots(game, qty)` is the only way a spot is taken, and it
runs before the card is charged.

```sql
update game_spots set status='held', held_at=now()
where id in (
  select id from game_spots
  where game_id = p_game and status = 'open'
  order by spot_number limit p_qty
  for update skip locked
)
```

`for update skip locked` is the whole thing. Two buyers going for the
last spot at the same instant both run this; the row lock means only one
sees it as open, and the other's subquery returns fewer rows than asked,
so its claim **fails as a unit** rather than overselling. Without `skip
locked` the second transaction would block, then take a row the first
already had.

All-or-nothing on purpose: a partial claim would hand somebody three of
the four spots they are paying for. Whatever was taken is put back and
the claim refuses.

Holds older than 15 minutes are reclaimed at the top of the next claim.
Without that, every crashed checkout would take a spot out of circulation
permanently and the game could never fill.

### How this is tested

**Against real PostgreSQL, not the local double.** The double is
single-threaded JavaScript: it serialises every request and would pass a
concurrency test whether or not the SQL were correct.

`race.mjs` spins up a real cluster, applies the real migration, and fires
ten separate `psql` processes — ten backends, ten transactions — held on
a **shared** advisory lock so they release together. Shared rather than
exclusive matters: an exclusive lock makes the workers queue, which is a
sequential test wearing a concurrency test's clothes.

The test is checked for teeth by swapping in a naive read-then-write
implementation, which sells one spot to all ten buyers and fails seven
assertions.

## Names on the board — opt-in

A sold spot is **anonymous by default**. The checkout has an unchecked
box reading "Show my first name on the spot board". Only a buyer who
ticks it appears, and then as first name plus last initial — the same
redaction the draw already applies.

Opt-in rather than opt-out because these are people buying spots in a
firearms sweepstakes, and publishing that without asking is a real
exposure. An opt-out would publish everyone who did not notice the box.

The public board reads `game_spot_board`, a view with **no email, phone,
surname or order id on it at all**. Those columns are not filtered, they
are absent — so no bug downstream can leak one.

The same rule applies to the draw presentation, which is the stricter
case: the board is a page somebody chooses to open, the presentation is
filmed and posted. A buyer who declined the board shows there as their
spot number.

## The draw

Unchanged, and it needed no arithmetic. `selectWinner` already took
weighted entrants; it now gets one entry per **sold** spot at weight 1.
Five spots is five rows is five chances.

The winning ticket number **is** the winning spot number, which is a
better thing to read aloud on camera than an abstract index. The seed,
the reproducibility and the presentation mode are untouched.

Held spots are not in the pool — drawing one would hand the prize to
somebody whose card may still decline.

## Money

A spot is an ordinary taxable line at 8.25%, in the merchandise subtotal.

It carries `fulfillment_type = 'none'`, its own value rather than
borrowing `pickup`. A spot is not posted and not collected; giving it a
real fulfillment type would attract postage or a collection notice.

**The winner pays no tax at collection**, because it was collected on
every spot sold. That is a note for the shop's accountant, not something
the code does.

## Terms

Three facts, shown twice: next to the buy control on the game page, and
again at checkout as a **required checkbox that blocks payment**. The
acceptance is stored on the order with a timestamp and the exact wording,
the same pairing as the firearms disclaimer — a timestamp without the
words it refers to proves only that somebody clicked something.

They live in `lib/games/terms.ts` rather than `lib/legal.ts`, which is
frozen until the attorney returns the sweepstakes wording. Merge them in
when that lands.

## What was removed

`entries_per_dollar`, `add_purchase_entries`, `entry_count`,
`entrant_count`, the `entrants` table, `orders.entries_awarded`,
`orders.entries_per_dollar`, and the `entry_pack` line type.

**Ordinary merchandise now generates nothing.** No product page, cart or
receipt mentions entries, because spending no longer earns anything.

Dropped outright rather than archived: the client confirmed campaigns,
entrants, entries, orders-with-entries and winners were all zero in
production. The two models are not convertible in either direction — an
entrant holding 47 entries earned at one-per-dollar corresponds to no
number of spots, because no pool and no per-spot price existed.

## Still open

**The free entry route is gone and the rules page still promises one.**
`app/actions/entry.ts` and the free entry form were deleted with the
`entrants` table they wrote to. `ENTRY_CLAIM` in `lib/legal.ts` is
untouched, so `/featured` and `/sweepstakes-rules` still carry "No
purchase necessary to enter or win".

That contradiction is contained rather than live: the rules page is
`noindex` and says in its own copy that it is not legal text and the
program must not open to the public until it is replaced. It has to be
resolved before the program opens, and it is the attorney's call, not
ours. The removal pass is mapped in `docs/content-needed.md`.
