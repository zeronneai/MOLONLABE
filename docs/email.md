# Email — what sends what

Two services, deliberately. They do different jobs and fail differently.

| | Order confirmations | Owner notifications |
| --- | --- | --- |
| Service | **Resend** | **Google Apps Script** web app |
| Goes to | the customer | the shop |
| Code | `lib/email/send.ts` | `lib/notify.ts` |
| Env | `RESEND_API_KEY`, `ORDER_EMAIL_FROM` | `GOOGLE_SCRIPT_URL` |
| Missing env | order completes, email skipped, `confirmation_sent_at` stays null | notification silently dropped |

The split is not an accident of history. The owner's notifications also
append a row to a Google Sheet — the shop works from that sheet — so
they go through the Apps Script that the client's other builds already
use. A customer-facing transactional email needs deliverability,
authentication and a real from-address on the shop's domain, which is
what Resend is for. Sending customer mail from an Apps Script would send
it from a Google account, not from the shop.

Check what is configured at **`/api/health`**, which reports presence
only and never echoes a key.

---

## Every email the system can send

### To the customer — Resend

**1. Order confirmation.** Sent by `app/actions/checkout.ts` immediately
after a card is approved and the order is written. Contains the lines,
the totals, the card's last four, both legal notices as accepted, what
the order earned in entries and the buyer's running total, and a link
back to the receipt that works for a year. It is the only email a
customer ever receives — there is no marketing, no shipping notice, no
account mail, because there are no accounts.

That is the whole list. One email, one trigger.

### To the shop — Google Apps Script

All of these `POST` a JSON payload with a `kind` field. The script
decides what the sheet row and the owner's email look like.

| `kind` | Trigger | Notes |
| --- | --- | --- |
| `inquiry` | Any of the four site forms — an item enquiry, an FFL transfer request, a general message, or a service request | `app/actions/inquiry.ts`. The form's `type` column says which |
| `entry` | Somebody submits a free entry | `app/actions/entry.ts` |
| `order` | A purchase completes | `app/actions/checkout.ts` |
| `order_error` | **Urgent.** Three cases: a card was charged but the order row failed to save; the order saved but its line items did not; the order did not receive its entries | Each carries `severity: "urgent"`. The first is the one that needs a person immediately — money moved and nothing recorded it |

The transfer form is not a separate path. `/transfers` posts the same
inquiry action with `type: "transfer"`, so one screen in the admin and
one notification kind cover all four.

---

## Vercel

Required for the site to function at all:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-only, never NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL             # the receipt links are built from this
```

Required for customer confirmations:

```
RESEND_API_KEY
ORDER_EMAIL_FROM                 # e.g. orders@molonlabefirearms.com, on a verified domain
```

Required for the shop to hear about anything:

```
GOOGLE_SCRIPT_URL
```

Required for payments:

```
NEXT_PUBLIC_AUTHORIZENET_ENV     # sandbox | production
AUTHORIZENET_API_LOGIN_ID
AUTHORIZENET_TRANSACTION_KEY     # server-only secret
NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY
```

`NEXT_PUBLIC_SITE_URL` matters more than it looks. The receipt link in
the confirmation email is absolute and is built from it, so if it is
wrong or missing on the deployment, every customer gets a link that goes
nowhere.

Two variables exist only for local testing and must be unset in Vercel:
`AUTHORIZENET_API_BASE` and `RESEND_API_BASE`. Both are guarded — the
first is ignored in production, the second only accepts a localhost
address — but they have no business being set on a deployment.

---

## "We couldn't send the email copy"

That line is on the receipt page and means `confirmation_sent_at` is
null: the order completed and is fully recorded, and only the email did
not go. Almost always `RESEND_API_KEY` or `ORDER_EMAIL_FROM` is missing
or the from-address is on a domain Resend has not verified.

The reason is written to the server log as
`Order MLF-XXXXXX: confirmation not sent — <detail>`, and the detail
says which. `/api/health` will show the same thing without needing a
test purchase.

Nothing is lost when this happens. The order, its lines, the accepted
disclaimer and the entries are all written before the email is
attempted, and the owner can see which orders need a copy sent by hand
by filtering on a null `confirmation_sent_at`.
