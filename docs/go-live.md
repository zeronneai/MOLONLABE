# Going live

The steps for switching the site from sandbox payments to the client's
live Authorize.net account, in order. Variable names are taken from the
code (`lib/payments/authorizenet.ts`, `app/api/health/route.ts`), not
from memory.

Do not announce the site until step 6 is done. Anything bought before the
cleanup cutoff is deleted by it.

## 1. The database

In the Supabase SQL editor, apply any of these the live database does
not have yet, in this order:

1. `supabase/migrations/20260927100000_guide_image_count.sql`
2. `supabase/migrations/20260928100000_staff_roles.sql`
3. `supabase/migrations/20260929100000_no_early_draw.sql`
4. `supabase/migrations/20260930100000_in_store_sales.sql`

The third is what stops a winner being recorded before a drop sells out.
The fourth adds in-store sales, and must be in place before the go-live
cleanup in step 6, which reads it to leave counter sales alone.
`npm run check:schema` checks columns only and will not tell you it is
missing.

## 2. Deploy this branch to production

Merge `claude/intro-arcade-game-scaffold-5nh29e` and let Vercel build
the Production deployment. It still takes sandbox payments at this
point.

## 3. The four payment variables

In Vercel, Project Settings, Environment Variables. Set each one for the
**Production** environment only. Leave Preview and Development on the
sandbox values, or every preview deployment will charge real cards.

| Variable | Set it to | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTHORIZENET_ENV` | `production` | No |
| `AUTHORIZENET_API_LOGIN_ID` | the live account's API Login ID | No, but server-side only |
| `AUTHORIZENET_TRANSACTION_KEY` | the live account's Transaction Key | **Yes.** Never `NEXT_PUBLIC_`, never committed |
| `NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY` | the live account's Public Client Key | No, public by design |

How the switch works:

- **`NEXT_PUBLIC_AUTHORIZENET_ENV` is the one that decides.** The word
  `production` (any capitals, surrounding spaces ignored) sends charges
  to `https://api.authorize.net` and loads Accept.js from
  `https://js.authorize.net`. **Anything else, including unset or a
  typo, means sandbox:** `apitest.authorize.net` and `jstest.authorize.net`,
  where no real card is ever charged.
- **The other three must all come from the live account.** Sandbox
  credentials do not work against production, or the reverse. If they
  are mixed, Authorize.net rejects every charge, and the buyer sees
  "We couldn't complete the payment. Nothing has been charged." If any
  of the three is empty, checkout refuses to take payment at all. Both
  fail safe (nothing is charged), but nobody can buy.
- **Where the values are in Authorize.net.** Use the live Merchant
  Interface, not the sandbox one. As of writing, all three settings
  below are under Account, Settings, Security Settings, General Security
  Settings:
  - API Credentials & Keys has the API Login ID and a new Transaction
    Key. Creating a new key can disable the old one, so create it once
    and paste it straight into Vercel.
  - Manage Public Client Key has the Public Client Key.
  - Test Mode must be **off**. While it is on, the live account
    approves transactions without charging them, and they come back
    with a transaction ID of 0.
- **`AUTHORIZENET_API_BASE` must not be set in Production.** It is only
  for the test suite, and the code ignores it in production anyway.

## 4. Redeploy

`NEXT_PUBLIC_` values are compiled into the build, so changing them does
nothing until the site is rebuilt. In Vercel, Deployments, open the
latest Production deployment and choose Redeploy, with "Use existing
Build Cache" **unticked**. Note the time the new deployment becomes
Ready.

## 5. Check it really is production

1. Open `https://molonlabeguns.com/api/health`. Under `payments`:
   - `mode` must be exactly `"production"`. This is computed the same
     way the checkout computes it, so it is the proof.
   - The three credentials must each say `"present": true`.
2. Open `/checkout` with something in the cart and view the page
   source. The Accept.js script must come from `js.authorize.net`, not
   `jstest.authorize.net`.
3. Buy one guide or one shop item with a real card. Confirm the order,
   the confirmation email and, for a guide, the guide numbers and the
   guide PDF. Then **void** it in the Authorize.net Merchant Interface
   (Transaction Search, Unsettled Transactions) so no money moves. Note
   the time you finished.

## 6. Remove the test orders

In the Supabase SQL editor, run the three files in
`supabase/repair/go-live/`, one at a time, in order:

1. **`1-preview.sql`.** Put the cutoff in it: the time just after the
   real-card test in step 5.3 finished, with its timezone, e.g.
   `'2026-09-27 14:30:00-06'`. Everything placed before the cutoff is
   treated as a test, including that voided real-card purchase. **In-store
   sales are never touched**, whenever they were recorded. The preview:
   - shows how many orders will be deleted and how many are kept (kept
     should be 0 if nobody else has bought yet)
   - shows which guides go back on sale, drop by drop
   - shows the stock the test orders took, which is **not** put back
     (adjust it by hand in the admin if you want to)
   - lists each drop's number of guides, price and status, so you can
     compare them after
2. **`2-cleanup.sql`.** Fill in the two values marked `FILL IN`: the same
   cutoff, and the number from the preview's "orders to delete" row. Run
   it. It runs in one transaction and refuses, changing nothing, if
   either value is blank, if the count no longer matches, or if any test
   guide is in a drop that has already been drawn.
3. **`3-verify.sql`.** Every row should say PASS. The last rows show
   each drop again; the Halloween drop's number of guides and price must
   match the preview.

The cleanup never changes items, stock, settings, or any drop's title,
description, featured piece, number of guides, price or guide text. A
drop's status can go from full back to open, and only if test purchases
filled it. `tests/db/golive.mjs` runs all three files against a copy of
this situation on every test run.

## 7. Then

- The domain: Vercel redirects `molonlabeguns.com` to
  `www.molonlabeguns.com`, but the site's canonical links and sitemap
  use the bare domain. Either make the bare domain primary in Vercel, or
  set `NEXT_PUBLIC_SITE_URL` to `https://www.molonlabeguns.com` for
  Production and redeploy.
- The rules and privacy pages are still `noindex`. The rules are final;
  taking `noindex` off is a one-line change in each page's metadata
  whenever the client wants them in search results.
- Transfers are switched off (`TRANSFERS_ENABLED` in `lib/brand.ts`)
  until the client decides the service and its price.
- WhatsApp is off permanently. All contact is by email or
  (915) 497-0541.
