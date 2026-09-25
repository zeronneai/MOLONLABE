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
   every 150 ms through setup, roster, wheel and result in 9:16 and 16:9,
   plus the summary the owner copies. Planting "spot" in a drop's
   description turns it red on eight surfaces.

**Neither can check what the owner types.** A drop title or description
he writes is shown as written. Existing orders keep the wording stored
on them when they were placed (order lines such as "September Rifle
Game — 3 spots", and the terms text the buyer accepted). That is a
record of what the buyer saw, and it is not rewritten.

## The rules, after the client's edits (25 September)

The client returned wording for most of the clauses that had been
frozen since the terminology ruling. Applied as sent, with his notes
turned into sentences where he wrote notes:

| # | Now reads |
| --- | --- |
| 01 | You must be 21 years or older to buy a guide and to win. |
| 03 | His eligibility paragraph, verbatim (`CLIENT_ELIGIBILITY`). Replaces the state-limit question. |
| 05 | All purchases are subject to Texas sales tax at 8.25%. |
| 06 | No refunds or exchanges. Also shown at display size under the page intro. |
| 07 | A person may buy as many guides as they want, up to the total offered in that drop. |
| 11 | Entry requires purchasing a guide. There are no free entries. |
| 12 | A drop runs until every guide is purchased. |
| 17 | By purchasing a guide, the buyer agrees to provide their full name, email and phone number so the shop can contact them if they win. |
| 18 | The winner has one week from being contacted to confirm and claim the prize. If they do not, the prize returns to the shop. |
| 19 | Unclaimed prizes are sold in store only and are not listed on the website again. |

The early-draw clause was deleted at his instruction. Numbers from 13
onward moved up by one.

**Still to be confirmed (seven)**, shown as "Wording to be confirmed" with the
subject only (`RULES_PENDING_WORDING` in `lib/games/rules.ts`):

| # (now) | Subject | Previous text |
| --- | --- | --- |
| 04 | How many guides a drop offers and at what price | Each game offers a fixed number of spots at a fixed price. Both are set when the game opens and neither changes while it runs. |
| 08 | How guide numbers are assigned | Spot numbers are assigned when you buy — you do not choose them. You get the lowest numbers still free, so if spots 2 and 4 have gone and you take three, you get 1, 3 and 5. |
| 09 | Adding more guides to a cart | Adding more spots to your cart for the same game adds to what is already there. Your cart shows the running total before you pay. |
| 10 | Guide numbers held during checkout | Your spots are held while you check out and are released back to the game if the payment does not complete. A spot is only yours once payment succeeds. |
| 13 | Which guides are in the drawing | One spot is drawn at random from the spots that have sold. Unsold spots are not in the drawing. |
| 14 | Each guide's chance of winning | Every sold spot has the same chance. Someone holding five spots therefore has five times the chance of someone holding one. |
| 23 | Whether buyers' names appear anywhere public | Spots are anonymous on the public board by default. A first name and last initial appear only if you ticked the box at checkout asking for that. Your email address and phone number are never shown. |

**15 was decided by the client on 25 September** and is published
verbatim: an electronic name wheel weighted by guides held, run at the
shop, broadcast on Instagram and saved as a reel, with every entry shown
before the wheel is spun. The draw presentation now does each of those
things; see "The draw" in `docs/handover.md`.

**Unedited and worth a look:** the heading "When a game closes" and
clause 16, "A game is drawn once. A game that already has a winner cannot
be drawn again", still say "game". Clause 24, "A winner is published the
same way", follows clause 23, which is still to be confirmed. Its em dash
became a colon.

**Checkout terms still allow an early draw.** The rules no longer
mention one, but `lib/games/terms.ts` says "The shop may draw earlier at
its discretion" and the admin still allows it. One of them has to change.

The checkout terms (`lib/games/terms.ts`) are the agency's wording and
are stored on each order as what the buyer agreed to, so they were
changed by word substitution only; `GAME_TERMS_VERSION` is
`2026-09-agency-3`.

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
