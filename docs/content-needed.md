# Content still needed from the client

Every place the site currently shows words or numbers that I wrote and
the client has not confirmed. Nothing here is lorem, a TODO marker, or
broken — the site reads as finished. That is exactly why this list
exists: none of it will announce itself.

Swept for `TODO`, `FIXME`, `lorem`, `placeholder`, `coming soon`, `TBD`
and hardcoded currency across all `.ts`, `.tsx`, `.sql` and `.css`. The
only literal markers left in the codebase are the intentional ones in
sections 1 and 2 below.

---

## 1. Legal — blocks launch

| What | Where | Status |
| --- | --- | --- |
| Sweepstakes rules, full text | `app/(site)/sweepstakes-rules/page.tsx` | **Attorney.** A 13-section checklist stands in for the terms. The page is `noindex` and says plainly that it is not legal copy. The entry program must not open to the public until this is replaced. |
| Privacy policy | `app/(site)/privacy/page.tsx` | **Drafted and live at `/privacy`, linked from the footer, marked for attorney review and `noindex`.** Written as real operative copy, because it describes what the site actually does. One explicit gap left for the lawyer: the retention period. |

## 2. Money — no longer visible, still undecided

| What | Where | Status |
| --- | --- | --- |
| Entry pack prices | `lib/payments/index.ts` → `ENTRY_PACKS` | **No longer on the page.** The whole paid tier is hidden behind `getPaymentProvider().configured`, which is false until Fortis lands. The invented $25/$50/$100 are not rendered and are not in the payload. They must be replaced with real numbers before a configured provider ever ships, or they will appear the moment one does. |
| Whether entry packs exist at all | Same file | Still my reading of the brief. If the sweepstakes is free-entry only, delete `ENTRY_PACKS`, `EntryPacks.tsx` and the guard rather than leaving them dormant. |

## 3. Copy I wrote in the brand's voice — needs a read-through

None of this is wrong, but none of it came from the client.

| What | Where |
| --- | --- |
| ~~Special Orders, Consignment, "Advice, free"~~ — **removed.** Only FFL Transfers remains, which the brief evidences with its own route and intake form. The page now says plainly that more happens at the counter. | `app/(site)/services/page.tsx`. Still needs the real lineup, which likely includes range, classes and gunsmithing — the brief mentioned them and I had no basis to claim them either way. |
| The shop story | `components/home/ShopStory.tsx` |
| Hero scroll copy: "GOOD AIM IS HALF OF IT" / "THE OTHER HALF IS IN THE CASE" / "COME GET YOURS" | `content/en.ts` |
| Every empty state | `components/ui/EmptyState.tsx` call sites |
| 404 and 500 copy | `components/ui/ErrorScreen.tsx` |
| Age gate wording | `components/compliance/AgeGate.tsx` |
| Inquiry and entry confirmation messages | `components/forms/InquiryForm.tsx`, `components/entry/FreeEntry.tsx` |
| How-it-works steps on `/featured` | `app/(site)/featured/page.tsx` |

## 4. Imagery still standing in

| What | Where |
| --- | --- |
| The shop story photo | `components/home/ShopStory.tsx` — now filled with the client-supplied Cloudinary image (`SHOP_IMAGE`), served through `f_auto,q_auto,w_1600`. Two things still open: it is an atmospheric shot, not the actual storefront or ceiling install the brief asks for, so swap it when those are photographed; and **the alt text is a guess** — Cloudinary is unreachable from the build sandbox, so nobody has verified the description against the picture. Confirm or correct it. |
| Seeded catalog | `supabase/seed.sql` — the four items from brief §8 with their real Cloudinary photos. Fine as a starting catalog; the owner replaces them as real stock lands. |
| ~~Seeded campaign~~ — **removed from `supabase/seed.sql`.** The featured page shows its empty state until the owner creates a real campaign. If an earlier run already inserted the demo, the file carries the `delete` statement to remove it. |

## 5. Settings the owner controls, currently at my defaults

These are all editable in the admin, so they are not blockers — but they
are live values the client should set deliberately.

| What | Default | Where |
| --- | --- | --- |
| ~~Discount code~~ — **cleared, and the offer switched off.** | was `MOLON10` | Admin → Game & Offer |
| ~~Reward description~~ — **cleared with it.** | was "10% off one accessory" | Admin → Game & Offer |
| Exclusions note | "Accessories and apparel only. Not valid on firearms." | Admin → Game & Offer (from the brief, self-heals if blanked) |
| Game difficulty | ~30% win rate target | Admin → Game & Offer |

The code and its value were mine, seeded by `20260812100000` with
`enabled: true`. That meant a discount the client never chose was live
and being handed to winners. `20260916100000` switches it off and blanks
both fields — conditionally, only where the seeded code and wording are
still exactly as seeded, so an edit the client has already made is left
alone. Nothing is offered by the game until they set their own and turn
it back on; the exclusions note is kept so a blank one can never mean
"valid on everything".

## 6. Confirmed — no longer needs anything

- Phone: **(915) 497-0541**, everywhere, from one constant.
- Address: **10024 Montana Ave Ste A, El Paso, TX 79925**, including the
  suite, in the footer, the visit page, the JSON-LD and the directions link.
- Hours, confirmed, with the 12-hour display derived from the 24-hour
  values the structured data needs.
- Brands: Taran Tactical, RetroRifle, Savior — from brief §8.
- Hero clip durations: 5 seconds, confirmed, with the Cloudinary
  measurement left in as the safety net.

> One stale reference remains and is deliberate: `PROJECT_BRIEF.md` line 5
> still reads "10024 Montana Ave" without the suite. That is the client's
> original brief and a historical record — correcting it would falsify
> what we were given.


## 7. Checkout — open items

Added with the Authorize.net build. The first three block launch; the rest
are known gaps with stated consequences.

| What | Where | Why it matters |
| --- | --- | --- |
| ~~**Sales tax rate**~~ — **answered.** | `settings` row `commerce.tax_rate_bps` | Set to **825** — 8.25%, the El Paso combined rate, given by the client. Charged on the merchandise subtotal only, never on postage. Editable at Admin → Tax & Shipping. |
| **Postage amounts** | `settings` rows `commerce.shipping_standard_cents` and `commerce.shipping_oversize_cents` | **Placeholders — $10.00 and $20.00 — and the only numbers on this list that will be charged to a real card without anyone re-reading them.** Two tiers, set per item: standard for apparel and small accessories, oversize for bulky gear. Collected-in-store is always zero. One charge per order, at the highest tier in the cart. The admin screen says in amber that these are stand-ins; it cannot make anyone read it. Set them before payments open. |
| **The free entry route is gone and the rules still promise one** | `ENTRY_CLAIM` in `lib/legal.ts`, `/sweepstakes-rules`, `/featured` | The fixed-pool rebuild deleted `entrants`, and the free entry form wrote to it — so `app/actions/entry.ts` and `components/entry/FreeEntry.tsx` went with it. `lib/legal.ts` was left untouched as instructed, so two pages still say "No purchase necessary to enter or win". Contained rather than live: the rules page is `noindex` and says in its own copy that it is not legal text and the program must not open until replaced. **Must be resolved before the program opens.** The removal pass is the row below. |
| **The no-purchase claims** | `ENTRY_CLAIM` in `lib/legal.ts` | Every sentence on the site asserting that a person can enter without buying is one object. **The fixed-pool rebuild already removed 9 of the 13 usages** — the product page, the cart, the receipt, both halves of the confirmation email, and all three in the free entry form (deleted outright). **4 remain**: `short` and `statement` on `/featured`, and `short` and `statement` on `/sweepstakes-rules`. `freeEntryStep()` and the `link`, `formLabel`, `formBody` and `received` keys are now unused and can simply be deleted. One of those sentences is in a customer's inbox rather than on a page we control, so if the model changes it has to change everywhere at once. Deleting a key fails the build at every site that used it. `freeEntryStep()` in the same file is the exception — a function, so its two sentences need a hand edit and nothing will fail the build for them. |
| **Customer email is sending from a Gmail address** | `EMAIL_PROVIDER` in the deployment | By decision, so testing is not blocked on a domain the client has not bought. Both consequences are real and neither is urgent: a transactional email from a Gmail address has no SPF or DKIM alignment with the shop's domain and will land in spam more often, and a Google account caps out at roughly 100 recipients a day (1,500 on Workspace). When the domain exists, `EMAIL_PROVIDER=resend` plus a key and a from-address is the whole migration — both paths are tested against the same build. `docs/email.md` has the detail. |
| **The agency's phone number** | `AGENCY_CONTACT` in `lib/brand.ts` | Currently the literal string "(number to be supplied)". It prints in the card-charged-but-order-not-saved alert, under "who to call" — the one email where the owner needs a person rather than a page. Harmless until that alert fires, useless at the moment it does. |
| **No-refunds wording** | `REFUND_POLICY` in `lib/legal.ts` | **Placeholder.** The substance was specified and the line is live and stored on every order, but the exact phrasing is still owed by the client. Currently "All sales are final. No refunds or exchanges." |
| **Pickup notice wording** | `PICKUP_NOTICE` in `lib/legal.ts` | Mine, not the attorney's. The client asked for a line making clear that paying is not completing the sale; this is my attempt at it and should go past the attorney with the rest. |
| **The footer disclaimer now contradicts the site** | `components/layout/Footer.tsx` line 110 | It reads "All firearm sales are conducted in person through a licensed dealer…", which was true when nothing was sold online. Accessories and optics now ship. The firearm half is still accurate; the sentence as a whole is not. This is legal-adjacent copy, so it is flagged rather than quietly rewritten. |
| **No stock counts on unsized items** | `items` has no quantity column | Partly closed: an item with sizes now has a real per-size count that decrements on purchase and cannot oversell. An item *without* sizes still has no figure, so a shipped one — a patch, a sticker — can be ordered up to 10 regardless of what is on the shelf. Firearms are unaffected: the status column already models one unit per row. |
| ~~**The firearm disclaimer shows on apparel**~~ — **scoped, on the client's instruction.** | `needsFirearmDisclaimer()` in `lib/admin/constants.ts`, applied by `components/inventory/PurchasePanel.tsx` | The attorney's text now appears on firearms and ammunition only — `pistol`, `revolver`, `rifle`, `shotgun`, `pcc`, `ammunition`. It no longer appears on apparel, accessories, optics or magazines. **Two things for the client to take back to the attorney.** First, the list itself: that is our reading of "firearms and ammunition", and `magazine` is the debatable one — it is excluded here because a magazine is not a firearm and needs no FFL, but several states regulate capacity, so if the attorney wants it covered it is one entry in that array. Second, the text is unchanged, and it opens "Know your state and local laws before purchasing" — a sentence that applied usefully to a magazine and now does not appear on one. The no-refunds line still appears on every product, since it applies to everything. The checkout checkbox is untouched and still blocks payment on every order, firearms or not, because a cart can mix both — so nobody buys anything without accepting the terms. |
| **Where the disclaimer lives is now a per-category decision** | `DISCLAIMER_CATEGORIES` in `lib/admin/constants.ts` | Worth knowing for later: a category added to the catalogue does **not** get the attorney's notice unless it is added to that array. If suppressors or other NFA items are ever stocked, that is a line to change and a lawyer to ask, not a default that will cover them. |
| **Entry packs** | `ENTRY_PACKS` in `lib/payments/index.ts` | Empty and unimplemented, by decision. The order model's second line type exists so adding them later is an implementation rather than a migration. The client decides whether they exist at all. |
| **Transfers to a buyer's own FFL** | not built | Out of scope for launch by decision: it needs licence collection, verification and per-order tracking. The order model can carry it; the flow is not built. Separate from `/transfers`, which handles inbound transfers into the shop. |


## 8. The entry program — one thing for the attorney, not for the code

**A person is identified by their email address, and one person can have
two.** `entrants` is keyed on `(campaign_id, lower(email))`, so entries
accumulate onto one row per address per campaign — a customer who buys
four times in a month has one row and one running count, which is what
makes a total possible at all.

The gap is that the address is the identity. Somebody who enters by the
free method with a personal address and then buys with a work address
becomes **two entrants with two separate counts**, and neither the site
nor the shop has any way to know they are the same human. Nothing
verifies an address either: the free entry form takes what it is given,
and so does checkout.

This is deliberately not being fixed in code, and it should not be. Any
technical fix is a guess about identity — merging on a name match would
combine two different J. Garcias, and merging on a phone number would
combine a household. Guessing wrong in a prize draw is the expensive
direction.

**It belongs in the terms.** The rules need to say which address counts,
what happens when one person appears twice, and whether entries under
different addresses are combined, left separate, or disqualified. Worth
raising with the attorney alongside the rest of the sweepstakes language,
because whatever he decides is a sentence in the rules rather than a
change to the site.

One related consequence worth stating in the same breath: because the
count is per campaign and not lifetime, "your entries" always means "in
this drawing". If the rules are ever written to promise anything that
carries across drawings, the schema would need to change to match.

## 9. Apparel — decisions to confirm

| What | Why it needs a person |
| --- | --- |
| **Which categories belong at /shop** | Currently apparel and accessories, per the brief's own logic that this is the part of the catalogue that ships without a legal conversation. Ammunition and magazines were deliberately left in `/inventory`: ammunition cannot go to every state, and magazines carry capacity limits in several. If the client wants them in the grid, it is one line — `SHOP_CATEGORIES` in `lib/admin/constants.ts`. |
| **The new categories** | `shotgun`, `ammunition`, `magazine` and `apparel` were added. Suppressors and other NFA items were deliberately left out: they need an SOT and a different transfer process, and listing them would imply the shop can sell them. Confirm that is right. |
| **Sizes are free text** | No fixed S–XXL list, so a one-size hat, a 34 waist and a 9.5 boot all fit. The cost is that "Med" and "Medium" are different sizes to the database; the form warns on an exact repeat but cannot catch a near-miss. |

## 10. The terms must allow an early draw

**This is the most consequential open item on this page.**

The terms buyers accept at checkout say the game runs until every spot
sells — that is the point of a fixed pool and it is why there is no end
date. The owner can now draw before that happens, because in practice a
game that stalls at 12 of 100 cannot sit open forever.

**The rules do not currently permit this.** As written, drawing early is
the shop doing something the buyer was told would not happen. What the
attorney needs to add, in substance:

- That the sponsor may draw before every spot sells, at its discretion.
- What happens to the odds when it does — a buyer who took one of 12 sold
  spots has a one-in-twelve chance, not one-in-a-hundred, which is better
  for them and should be said rather than left to be worked out.
- Whether there is any floor: a minimum number sold, or a minimum time
  open, before an early draw is allowed at all.
- Whether buyers are told in advance, and how.

**What the build already does**, so the attorney is writing rules for
behaviour that exists rather than in the abstract:

- The owner cannot draw early by accident. A second confirmation names
  the shortfall — "This game has 88 of 100 spots unsold. Drawing now goes
  against the terms buyers agreed to. Continue?" — and on the filmed
  presentation screen the acknowledgement is a checkbox on the setup
  page, before recording starts, rather than a dialog mid-take.
- Every early draw is recorded: `winners.drawn_early` and
  `winners.unsold_spots`. It is not a matter of memory.
- It is shown publicly. A game drawn short carries "Drawn with N unsold"
  on its card, so the history does not quietly present it as a game that
  filled.

Until the rules change, the honest position is that this is a capability
the shop has and has not yet been given permission to use.

## 11. Copy for the three surfaces

The site is now Shop, Games and In the case. The headings and standfirsts
on those three pages are mine, not the client's, and they set the tone for
the whole site:

| Page | Current heading | What it needs to do |
| --- | --- | --- |
| `/shop` | PICK IT UP. | Say this is the part you can just buy. |
| `/games` | A FIXED NUMBER. | Say a game runs until it fills, with no date. |
| `/in-the-case` | (the hero's payoff line) | Say these are real firearms you ask about in person. |

Worth ten minutes with the client. They are the first thing a visitor
reads on each surface and they are currently a developer's guess at his
voice.
