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

## The rules, after the client's edits (25 and 26 September)

The client returned wording for most of the clauses that had been
frozen since the terminology ruling (25 September), then decided the rest
of the open questions (26 September). Numbers below are the page's
current numbering: clause 02 was cut, so everything after it moved up
one from the numbering used on 25 September.

| # | Now reads |
| --- | --- |
| 01 | You must be 21 years or older to buy a guide and to win. |
| 02 | His eligibility paragraph, verbatim (`CLIENT_ELIGIBILITY`). The lawful-possession clause that stood before it was cut because it repeated this. |
| 04 | All purchases are subject to Texas sales tax at 8.25%. |
| 05 | No refunds or exchanges. Also shown at display size under the page intro. |
| 06 | A person may buy as many guides as they want, up to the total offered in that drop. |
| 10 | Entry requires purchasing a guide. There are no free entries. |
| 11 | A drop runs until every guide is purchased. (Heading: "When a drop closes".) |
| 14 | How the winner is picked: his wording, verbatim (`CLIENT_DRAW_METHOD`). |
| 15 | A drop is drawn once. A drop that already has a winner cannot be drawn again. |
| 16 | By purchasing a guide, the buyer agrees to provide their full name, email and phone number so the shop can contact them if they win. |
| 17 | The winner has one week from being contacted to confirm and claim the prize. If they do not, the prize returns to the shop. |
| 18 | Unclaimed prizes are sold in store only and are not listed on the website again. |

The early-draw clause was deleted at his instruction, and on 26 September
the early draw was removed everywhere else too: the checkout terms, the
admin, the presentation, the server action and the database.

**Drafted by the agency on 26 September, for the client to confirm as a
set (seven).** Written from what the system does, and published with a
"Wording to be confirmed" marker (`RULES_DRAFTS` in `lib/games/rules.ts`;
approving one means removing `pending` from its clause):

| # | Draft | Was (25 Sept) |
| --- | --- | --- |
| 03 | Each drop offers a set number of guides at a set price per guide. Both are fixed when the drop is created and do not change while it runs. | 04 |
| 07 | Each guide in a drop has a number, from 1 up to the number of guides offered. Numbers are assigned automatically at checkout from those still available, lowest first. A buyer cannot choose them, and a buyer who gets several may not get consecutive numbers. | 08 |
| 08 | Adding more guides from the same drop to a cart adds them to the guides already there, and the cart shows the running total before payment. A cart holds guides from one drop at a time. If fewer guides are left than the cart holds, the cart is reduced to the number left before payment. | 09 |
| 09 | Guide numbers are set aside when the buyer submits payment and are held while the payment is processed. If the payment does not go through, they are released at once. If the payment is interrupted, they are released after 15 minutes. A guide belongs to the buyer only once payment succeeds. | 10 |
| 12 | A drop is drawn only after every guide has been sold, and every guide sold is in the drawing. | 13 |
| 13 | Each guide is one entry, and every entry has the same chance of winning. A person holding five guides has five times the chance of a person holding one, and five times the share of the wheel. | 14 |
| 22 | This website shows how many guides a drop has left, never who bought them. During the drawing, each buyer's first name and last initial appear on screen, as stated at checkout. A buyer who bought before checkout stated this appears by guide number instead. Email addresses, phone numbers and full surnames are never shown. | 23 |

What each draft rests on, so it stays true:

- 03: the admin never offers to edit count or price after creation, and
  since 26 September the database refuses it (`refuse_pool_change`).
- 07: `claim_game_spots`, lowest open number first.
- 08: `addSpots` in `lib/cart/store.tsx` and the drop rules in
  `lib/cart/pricing.ts`.
- 09: `claim_game_spots` runs when Pay is pressed, before the charge;
  `release_game_spots` on a decline; holds older than 15 minutes are
  released by the next claim and, since 26 September, counted as
  available (`game_spots_remaining`), so they cannot strand a drop.
- 12: `commitDraw` and `refuse_early_draw`.
- 13: `lib/draw/select.ts`, one entry per guide; the wheel's wedges in
  `lib/draw/roster.ts`.
- 22: `BROADCAST_NOTICE` at checkout, stored on the order;
  `lib/draw/soldGuides.ts` and `buildRoster` for who is named.

The checkout terms (`lib/games/terms.ts`) are the agency's wording and
are stored on each order as what the buyer agreed to.
`GAME_TERMS_VERSION` is `2026-09-agency-4`: the early-draw sentence is
gone, and the client's broadcast acknowledgement is a separate required
box, stored in the same text. Orders placed before keep what they were
shown.

## Em dashes

The client does not want them anywhere a customer reads. They were
removed from every public page, page title, the cart, checkout and its
messages, the confirmation email, the guide PDF and the draw
presentation on 26 September. `scripts/check-copy.mjs` fails the build
on a new one in any file outside the admin, and `tests/browser/wording.mjs`
reads the rendered pages, email, PDF and every draw frame for them.
Text the owner types (a drop description, an item's notes) is shown as
written and is not checked by the build; the rendered-page test would
catch one in the test data only.

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
