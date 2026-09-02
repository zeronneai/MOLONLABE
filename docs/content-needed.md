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
| Discount code | `MOLON10` | Admin → Game & Offer |
| Reward description | "10% off your next accessory" | Admin → Game & Offer |
| Exclusions note | "Accessories and apparel only. Not valid on firearms." | Admin → Game & Offer (from the brief, self-heals if blanked) |
| Game difficulty | ~30% win rate target | Admin → Game & Offer |

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
| **Sales tax rate** | `settings` row `commerce.tax_rate_bps`, basis points | Defaults to **0**, which is certainly wrong. The correct figure for the shop's jurisdiction is the client's accountant's to state — inventing one is a filing problem, not a rounding error. `docs/authorizenet-sandbox.md` step 4 has the SQL. |
| **Shipping charge** | `settings` row `commerce.shipping_flat_cents` | Defaults to **0**, so shipped orders currently post free. Flat rate only; anything by weight or zone needs building. |
| **No-refunds wording** | `REFUND_POLICY` in `lib/legal.ts` | **Placeholder.** The substance was specified and the line is live and stored on every order, but the exact phrasing is still owed by the client. Currently "All sales are final. No refunds or exchanges." |
| **Pickup notice wording** | `PICKUP_NOTICE` in `lib/legal.ts` | Mine, not the attorney's. The client asked for a line making clear that paying is not completing the sale; this is my attempt at it and should go past the attorney with the rest. |
| **The footer disclaimer now contradicts the site** | `components/layout/Footer.tsx` line 110 | It reads "All firearm sales are conducted in person through a licensed dealer…", which was true when nothing was sold online. Accessories and optics now ship. The firearm half is still accurate; the sentence as a whole is not. This is legal-adjacent copy, so it is flagged rather than quietly rewritten. |
| **No stock counts** | `items` has no quantity column | A shipped line can be ordered in a quantity the shop does not have. Pickup lines are capped at one because the status column already models one unit per row, so firearms cannot oversell. Shipped goods can, up to 10. The owner sees the order and can call the buyer. |
| **Entry packs** | `ENTRY_PACKS` in `lib/payments/index.ts` | Empty and unimplemented, by decision. The order model's second line type exists so adding them later is an implementation rather than a migration. The client decides whether they exist at all. |
| **Transfers to a buyer's own FFL** | not built | Out of scope for launch by decision: it needs licence collection, verification and per-order tracking. The order model can carry it; the flow is not built. Separate from `/transfers`, which handles inbound transfers into the shop. |
