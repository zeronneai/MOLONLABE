# Verifying checkout against the Authorize.net sandbox

## Why this document exists

The sandbox this was built in blocks `*.authorize.net` at the network
policy — the proxy answers 403 to CONNECT for `apitest.authorize.net`,
`jstest.authorize.net` and `js.authorize.net`. Credentials do not change
that; the connection cannot be opened at all. Supabase is blocked the same
way.

So the checkout was verified against local doubles that speak the same
protocols, and the last mile — real Accept.js in a real browser, real
Authorize.net, real Postgres — has to be run by someone whose machine can
reach them. This is that procedure.

## What was verified here, and how

A local HTTP double stood in for both services. Every line of application
code in the path is the shipped code: the cart pricing, the checkout
action, the gateway client, the order write, the entry award, the email
renderer. Only the far side of each wire was fake.

The double deliberately reproduces the gateway's two awkward behaviours:
it prefixes JSON responses with a UTF-8 BOM (the single most common reason
a first Authorize.net integration fails with "Unexpected token"), and it
returns the documented `responseCode` values including a decline.

55 assertions passed, covering: server-side pricing, the disclaimer in all
three placements, the checkbox gate, a declined card leaving no order and
releasing stock, the successful order's arithmetic, the stored acceptance
timestamp and text, entry award and rounding, item status transitions, and
the absence of any card number or CVV anywhere in the stored record.

What that does **not** prove:

- That Accept.js loads and tokenizes a real card. The browser stub returns
  the same shape Accept.js does, but it is a stub.
- That real credentials are accepted.
- That the SQL in the migration runs. The double is not Postgres — it does
  not enforce the check constraints, the unique indexes, the foreign keys
  or the RLS policies. **This is the largest untested area.**

## Step 1 — credentials and connectivity

```bash
set -a && . ./.env.local && set +a
node scripts/verify-authorizenet.mjs
```

Charges nothing. It calls `authenticateTestRequest`, which proves the
endpoint is reachable, the API Login ID and Transaction Key are a valid
pair for that environment, and the BOM-prefixed response parses.

The script also warns if the Public Client Key looks too short, because
pasting the Transaction Key into `NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY` is
a common mix-up that fails confusingly late.

## Step 2 — apply the migration

```bash
supabase db push
```

`supabase/migrations/20260902100000_checkout.sql`. It adds `price_cents`
and `fulfillment_type` to items, `entries_per_dollar` to campaigns, the
`orders` and `order_items` tables, and the `add_purchase_entries`
function.

Nothing becomes buyable by running it: `price_cents` defaults to NULL, and
an item with no price cannot enter a cart. `fulfillment_type` defaults to
`pickup`, so an item can never become shippable by omission.

## Step 3 — make something purchasable

In the admin, open an item and set **Online price**. Set **How it reaches
the buyer** deliberately — that field decides whether the item can be put
in the post, and it defaults to collect-in-store for exactly that reason.

Then open the live campaign and check **Entries per dollar**.

## Step 4 — set tax and shipping

Both default to zero and both are wrong at zero. There is no admin screen
for them yet; set the row directly:

```sql
insert into public.settings (key, value)
values ('commerce', '{"tax_rate_bps": 825, "shipping_flat_cents": 1200}')
on conflict (key) do update set value = excluded.value;
```

`tax_rate_bps` is basis points — 825 is 8.25%. The correct figure for the
shop's jurisdiction is the client's accountant's to state, not ours.

## Step 5 — a real purchase

With `NEXT_PUBLIC_AUTHORIZENET_ENV=sandbox`, add items to the cart and pay
with an Authorize.net test card:

| Card | Result |
| --- | --- |
| 4111111111111111 | approves |
| 4000000000000002 | declines |
| 5424000000000015 | approves (Mastercard) |
| 370000000000002 | approves (Amex, 4-digit CVV) |

Any future expiry, any CVV. Use ZIP 46282 if you want AVS to match.

Check afterwards:

1. The order appears in `/admin/orders` with the acceptance timestamp.
2. `orders.disclaimer_text` holds the attorney's wording in full, and
   `disclaimer_version` is separate from it.
3. No card number anywhere: `select * from orders` should show only
   `card_brand` and `card_last4`.
4. The firearm's status is `reserved`, not `sold`. It stays reserved until
   the background check clears at the counter; a failed check puts it back
   on the shelf.
5. The buyer appears in `entrants` with `entry_method = 'purchase'` and
   the right entry count.
6. The transaction is in the Authorize.net sandbox dashboard under
   Transaction Search, with the order number as the invoice number.

## Step 6 — the confirmation email

Set `RESEND_API_KEY` and `ORDER_EMAIL_FROM` on a verified sending domain.
Without them the order still completes and is recorded correctly; the
email is skipped, `confirmation_sent_at` stays null, the confirmation page
tells the buyer, and the admin order row shows "email NOT sent".

## Going live

1. Swap the three Authorize.net variables for production values.
2. Set `NEXT_PUBLIC_AUTHORIZENET_ENV=production`. This is the variable that
   decides whether real money moves — it picks both the API endpoint and
   the Accept.js script, and it is deliberately not inferred from
   `NODE_ENV`.
3. Make sure `AUTHORIZENET_API_BASE` is unset. It is ignored in production
   as a second guard, but leaving it set is confusing.
4. Re-run step 1 against production. It still charges nothing.
