# Drops: one page each

Written 2 October, after a report that with two drops open (BOOM STICK
and Orthos) clicking one opened the other.

## What was wrong

Drops did not have their own pages. There was one "current drop" page,
`/featured`, and it showed the **newest drop still open**. Every button
that meant a drop pointed at it: the home page, every card on the drops
list, "Get your guide", the item page of a featured piece, the receipt,
and the email. So with two drops open:

- The older drop could not be reached at all. Its card on the drops list
  and every other button led to the newer one.
- A buyer who clicked the older drop was shown the newer one, and could
  only buy guides for the newer one. The cart, checkout and receipt did
  name the drop, but in small type, and the page headline was the
  featured piece's name, not the drop's.
- Adding guides for a second drop silently replaced the first drop's
  guides in the cart.
- The email also still said the draw could happen "or earlier if the
  shop decides". Early draws were removed on 28 September; that line had
  been missed.

The home page and `/featured` chose the same way, so at any one moment
they showed the same drop. If the home page showed BOOM STICK and
`/featured` showed Orthos, the likeliest explanations are that Orthos
opened between the two views, or that one of the names is the featured
piece and the other the drop's title (the home page headline was the
piece's name). The first file below lists every drop with both names.

## What changed

- `/games/<id>` is each drop's page. Every link, card, button, cart
  line, receipt link and email link points at the specific drop.
  `lib/games/paths.ts` is the one place the address is built.
- Every surface names the drop by its title, with "Featured piece: ..."
  underneath when the piece is named differently.
- The home page features the drop the owner chooses in the admin
  (`games.featured_on_home`, `set_home_drop()`, owner only, logged, one
  at a time, never a drawn drop). With nothing chosen: the one running
  drop if there is one, otherwise every running drop.
- `/featured` only forwards (see `app/(site)/featured/page.tsx`).
- The drop's page warns, by name, when the cart already holds another
  drop's guides.
- Checkout names the drop above the terms. The terms and broadcast
  boxes clear if the cart switches drop, and the server refuses a
  payment whose drop is not the one the page named (`spotGameId` in
  `app/actions/checkout.ts`).
- The sitemap lists every drop's page (not demo drops) instead of
  `/featured`.

Tests: `tests/browser/twodrops.mjs` (two open drops through every
surface, the owner and the manager at the home page choice),
`tests/db/homedrop.mjs` (the migration's rules, and both check files).

## Checking the orders already taken

Two files in `supabase/repair/drop-check/`. Both only read. Paste each
into the Supabase SQL editor and run it; the editor shows one result per
run, which is why there are two.

1. **`1-integrity.sql`**: every row should say PASS. It proves every
   guide sale, online or in store, is recorded against one drop
   throughout: the order, its guide line, and the guides it holds all
   name the same drop, and the numbers on the receipt are exactly the
   guides it holds. The INFO rows count each drop's sales.
2. **`2-orders-to-review.sql`**: every online guide order, with the
   other drops that were open when it was paid.
   - **OK**: no other drop was open, so the drop bought is the only one
     that could have been meant.
   - **REVIEW**: another drop was open at that moment, and the buyer
     could only have bought the newest one. They may have meant the
     other. The row has their email and phone, the drop bought, the
     guide numbers and the other drop's name. Ask them.

The database records exactly what each buyer paid for; nothing in it
records what they meant, so REVIEW rows can only be settled by asking.
If a buyer meant the other drop, call Purple Roots before doing
anything. A refund in Authorize.net returns the money but does not
return the guides: the site has no refund tool for online orders, so the
guides stay sold in that drop (and the buyer stays in its drawing) until
they are corrected in the database. Nothing in these files changes
anything.
