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
| Privacy policy | Footer says "Privacy policy — coming soon" | No page exists. Needs a decision: write one, or drop the line. Visible on every page as-is. |

## 2. Money — blocks the paid entry route

| What | Where | Status |
| --- | --- | --- |
| Entry pack prices | `lib/payments/index.ts` → `ENTRY_PACKS` | **I invented these**: 5 entries $25, 15 for $50, 40 for $100. They are on screen right now, next to a disabled "Opens soon" button. Wrong numbers in front of customers is worse than no numbers — if the client has not decided, say so and I will hide the prices until they have. |
| Whether entry packs exist at all | Same file | The whole paid tier is my reading of the brief. If the sweepstakes is free-entry only, that section should come out. |

## 3. Copy I wrote in the brand's voice — needs a read-through

None of this is wrong, but none of it came from the client.

| What | Where |
| --- | --- |
| The four services and their descriptions — FFL Transfers, Special Orders, Consignment, "Advice, free" | `app/(site)/services/page.tsx`. The brief said only "range, classes, gunsmithing, whatever they offer" — **note I did not include range or classes, because I do not know whether they have them.** This list is a guess at the real lineup. |
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
| The shop story photo | `components/home/ShopStory.tsx` — currently a product shot. The brief asks for **the storefront and the ceiling install**. Needs a real photograph. |
| Seeded catalog | `supabase/seed.sql` — the four items from brief §8 with their real Cloudinary photos. Fine as a starting catalog; the owner replaces them as real stock lands. |
| Seeded campaign | `supabase/seed.sql` — "SIG MPX Carbon — Current Feature", 30-day window, my description. Delete or rewrite before launch. |

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
