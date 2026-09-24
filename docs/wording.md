# Wording: guides, not spots

The attorney's ruling: **what a customer buys is a guide to the featured
piece, and entry into the drawing comes with it.** "Spot", "ticket",
"raffle" and "lottery" describe a different legal product. None of them
may appear anywhere a customer or member of staff can read.

Database tables and columns keep their names (`game_spots`,
`spot_number`, `spot_price_cents`). That is code, not copy.

## Vocabulary

| Was | Now |
| --- | --- |
| spot | guide |
| spot number | guide number, written **Guide #17** |
| game (the thing on sale) | featured drop; **drop** once it is clear |
| the prize in a game | the featured piece |
| ticket, entry in the pool | entry ("Every guide was one entry.") |
| Take a spot | Get your guide / Get 3 guides |
| Spots left | Guides left |
| Games (navigation, admin tab) | Drops |

"Draw" and "drawing" stay. The arcade is still a game: "Arcade & Offer",
"Games played" and the intro game are about the arcade, not about drops.

## How it is kept out

Two checks, and neither depends on anybody remembering.

1. **`scripts/check-copy.mjs` runs in `npm run build`** and fails it. It
   parses every string and piece of JSX text in `app/`, `components/`
   and `lib/`, skipping comments, identifiers and strings handed to the
   database query builder. A string that is genuinely never shown can be
   marked on its line with `// copy-check: internal <reason>`. There are
   four, all payload values or discriminants; `npm run check:copy --
   --list` prints them.
2. **`tests/browser/wording.mjs`** reads the artifacts: every public page
   and every admin page as owner and as manager (text, title, meta tags,
   alt, aria-label, placeholder, hidden menus), the confirmation email as
   sent, every owner alert, the guide PDF's own text, the CSV export and
   its filename, the stored order line, and the draw presentation sampled
   every 150 ms through setup, pool, spin and result in 9:16 and 16:9,
   plus the summary the owner copies. Planting "spot" in a drop's
   description turns it red on eight surfaces.

**Neither can check what the owner types.** A drop title or description
he writes is shown as written. Existing orders keep the wording stored
on them when they were placed (order lines such as "September Rifle
Game — 3 spots", and the terms text the buyer accepted). That is a
record of what the buyer saw, and it is not rewritten.

## Clauses waiting on the attorney

Every rules clause that used the old words was legal wording, frozen
until the attorney returns it. None has been reworded. Each shows on
`/sweepstakes-rules` as **"Awaiting the attorney's wording"** with a line
naming its subject, from `RULES_NEEDS_ATTORNEY` in `lib/games/rules.ts`.
Their previous text, for the attorney to work from:

| # | Subject shown | Previous text |
| --- | --- | --- |
| 01 | Minimum age to buy a guide and to win | You must be 21 or older to buy a spot or to win a prize. |
| 04 | How many guides a drop offers and at what price | Each game offers a fixed number of spots at a fixed price. Both are set when the game opens and neither changes while it runs. |
| 05 | That buying a guide is a purchase, and how sales tax applies | Buying a spot is a purchase, not an entry fee. Texas sales tax is added at checkout at the rate in force at the time — currently 8.25%. The total shown at checkout is the amount you pay. |
| 06 | Refunds, exchanges and transfers | Spot purchases are final. No refunds, no exchanges, no transfers. This applies whether or not you win. |
| 07 | Limits on how many guides one person or order may buy | You may buy as many spots as you like, up to however many are left in the game. There is no limit per person and no limit per order. |
| 08 | How guide numbers are assigned | Spot numbers are assigned when you buy — you do not choose them. You get the lowest numbers still free, so if spots 2 and 4 have gone and you take three, you get 1, 3 and 5. |
| 09 | Adding more guides to a cart | Adding more spots to your cart for the same game adds to what is already there. Your cart shows the running total before you pay. |
| 10 | Guide numbers held during checkout | Your spots are held while you check out and are released back to the game if the payment does not complete. A spot is only yours once payment succeeds. |
| 11 | Whether there is any way to enter without buying | A spot can only be bought. There is no free or alternative way to get one. |
| 12 | How long a drop runs | A game runs until every spot is sold. There is no end date and no countdown. |
| 13 | Holding the drawing before every guide is sold | The shop may hold the drawing before every spot is sold, at its sole discretion. Where that happens, the number of spots left unsold is recorded and shown on the game. |
| 14 | Which guides are in the drawing | One spot is drawn at random from the spots that have sold. Unsold spots are not in the drawing. |
| 15 | Each guide's chance of winning | Every sold spot has the same chance. Someone holding five spots therefore has five times the chance of someone holding one. |
| 16 | The recorded random seed | The drawing uses a recorded random seed. The shop keeps that seed, the winning spot number and the number of spots sold, so the drawing can be run again from the record and checked against the result that was announced. |
| 18 | How the shop contacts the winner | The shop contacts the winner directly, using the name, email address and phone number given when the spots were bought. Keep those details current — they are the only way the shop has to reach you. |
| 24 | Whether buyers' names appear anywhere public | Spots are anonymous on the public board by default. A first name and last initial appear only if you ticked the box at checkout asking for that. Your email address and phone number are never shown. |

Also in `lib/games/rules.ts`:

- **The eligibility summary** under every "Official rules" link: "Spot
  purchases are final." is replaced with "[Final-sale sentence: awaiting
  the attorney's wording.]" The rest of that line is unchanged.
- **One heading changed**: "How spots work" is now "How guides work".
  A heading, not a clause, and it only applies the ruling; listed so it
  can be overruled.
- **Left as written, because they contain none of the four words** but
  still say "game": the heading "When a game closes" and clause 17, "A
  game is drawn once. A game that already has a winner cannot be drawn
  again."

**Not placeholdered, deliberately: the checkout terms** in
`lib/games/terms.ts`. They are the agency's wording, not the attorney's,
and the text is stored on each order as what the buyer agreed to, so a
placeholder there would be recorded as the buyer's consent. They were
changed by word substitution only (spot to guide, game to drop), and
`GAME_TERMS_VERSION` moved to `2026-09-agency-3`.

## Where "guide" reads worse

For the client to choose the wording:

1. **Buying more than one.** "Get 3 guides", "How many guides", "3
   guides in your cart". A customer is buying three copies of the same
   guide to get three entries, and receives one PDF.
2. **"Your guide" twice in the email.** The guide-numbers panel ("Your
   guide from September Rifle Drop, guide number 12 of 100") sits above
   the link panel ("Your guide to the SIG MPX Carbon. Open your guide").
   With several guides it reads "3 guides from … guide numbers 12, 13,
   14" beside a single document.
3. **Chances.** "Somebody holding five guides has five chances" (admin
   draw panel), "Every guide was one entry" (the copied draw summary).
4. **"Guide" means two things in the admin.** The owner's three "guide
   sections" (the document) and "Guides sold" (what was bought) now
   share a word on the same page.
5. **Held numbers.** "3 guides are mid-checkout" and "held guide
   numbers" in the problem alerts.
