# Email — what sends what

**Everything goes through the Google Apps Script.** One `POST` to
`GOOGLE_SCRIPT_URL`, one payload shape, a `kind` field that says what it
is. The script decides what to write to the sheet and what to send.

The Resend path is still in the code behind `EMAIL_PROVIDER` and is not
wired up. It exists for the day the client has a domain — see
[Moving the customer confirmation to Resend](#moving-the-customer-confirmation-to-resend).

| | Value |
| --- | --- |
| Endpoint | `GOOGLE_SCRIPT_URL` |
| Method | `POST`, `content-type: application/json` |
| Sent by | `lib/notify.ts` (owner) and `lib/email/send.ts` (customer) |
| Every payload has | `kind` and `submitted_at` (ISO 8601, UTC) |

Two things the script must honour:

1. **The customer's email arrives already rendered.** `kind:
   "order_confirmation"` carries finished `html` and `text`. Send them as
   they are. Do not rebuild the email in the script — the design, the
   attorney's disclaimer and the running entry total live in
   `lib/email/orderConfirmation.ts`, and a second copy in Apps Script is
   a second thing to keep in step and one nothing here can test.

2. **Answer quickly and never make the site wait.** The request is made
   with a 15-second timeout and its result only decides whether
   `confirmation_sent_at` gets written. A failure never fails an order —
   the card, the order row, the line items, the accepted disclaimer and
   the entries are all committed before the email is attempted.

### How the script reports failure

Return HTTP 200 with a JSON body:

```json
{ "ok": true }
```

To report a failure — the daily Gmail cap being the realistic one:

```json
{ "ok": false, "error": "Service invoked too many times for one day: email." }
```

Only an explicit `ok: false` is treated as a failure. Anything else with
a 2xx status, including the HTML page Apps Script returns by default, is
taken as accepted. A non-2xx status is also a failure.

When a send fails: the order stands, `confirmation_sent_at` stays null,
the receipt page tells the buyer the copy did not go, the `order`
notification carries `confirmation_emailed: false`, and the server log
gets `Order MLF-XXXXXX: confirmation not sent — <reason>`.

Because `sent: true` only means the script accepted the request — its own
mail send happens afterwards — `confirmation_sent_at` under Apps Script
means "handed over", not "delivered". Under Resend it means the provider
accepted it for delivery. Neither is proof of arrival.

---

## Payload shapes

All captured from a real run, not written from memory.

### `order_confirmation` → the customer

The only email a customer ever receives. Triggered immediately after a
card is approved and the order is written.

```json
{
  "kind": "order_confirmation",
  "to": "dana.ruiz@example.com",
  "subject": "Order MLF-AFUVLU — Molon Labe Firearms x SunCity Outdoors",
  "html": "<!doctype html>… ~5 KB …",
  "text": "… ~1.2 KB …",
  "from": "orders@molonlabe.example",
  "order_number": "MLF-AFUVLU",
  "submitted_at": "2026-09-09T21:59:50.614Z"
}
```

| Field | Notes |
| --- | --- |
| `to` | A single address, not an array. (Resend's own API takes an array; that shape never reaches the script.) |
| `subject` | Use as given |
| `html` | Send as the HTML body, unmodified |
| `text` | Send as the plain-text alternative |
| `from` | **Only present when `ORDER_EMAIL_FROM` is set, and only honoured if the Google account has that address as a verified alias.** Absent, send from the account's own address |
| `reply_to` | Optional; currently never sent |
| `order_number` | For the sheet row. Format `MLF-` + six characters |

### `inquiry` → the shop

All four site forms. `type` says which: `item`, `transfer`, `general`,
`service`. `/transfers` is not a separate path — it posts this with
`type: "transfer"`.

```json
{
  "kind": "inquiry",
  "type": "transfer",
  "item_id": null,
  "name": "Alma Cortez",
  "email": "alma.cortez@example.com",
  "phone": "915-555-0142",
  "message": null,
  "item_slug": null,
  "submitted_at": "2026-09-09T21:59:47.493Z"
}
```

`phone`, `message`, `item_id` and `item_slug` are `null` when not given —
present as keys, never absent. `item_id` and `item_slug` are set only for
an enquiry raised from a product page.

### `entry` → the shop

A free entry was submitted.

```json
{
  "kind": "entry",
  "name": "Marco Peña",
  "email": "marco.pena@example.com",
  "phone": "915-555-0188",
  "campaign": "September Rifle Giveaway",
  "method": "free",
  "submitted_at": "2026-09-09T22:00:08.108Z"
}
```

`name` is already joined into one string. `campaign` is the title, not an
id. `method` is always `"free"` — purchase entries are reported by the
`order` kind instead, so nothing is counted twice.

### `order` → the shop

A purchase completed. Sent after the confirmation is attempted, which is
why it can report whether that worked.

```json
{
  "kind": "order",
  "order_number": "MLF-AFUVLU",
  "total_cents": 2299,
  "name": "Dana Ruiz",
  "email": "dana.ruiz@example.com",
  "phone": null,
  "ships": ["Skull Patch"],
  "collects": [],
  "entries_awarded": 12,
  "confirmation_emailed": true,
  "submitted_at": "2026-09-09T21:59:50.618Z"
}
```

| Field | Notes |
| --- | --- |
| `total_cents` | Integer cents. `2299` is $22.99 |
| `ships` | Item names going in the post. Array, possibly empty |
| `collects` | Item names collected at the counter. **A non-empty `collects` means somebody is driving to the shop and a background check is due** |
| `entries_awarded` | This order only, not the running total |
| `confirmation_emailed` | `false` means the customer has no copy and needs one sent by hand |

An order can have both `ships` and `collects` — an optic in the post and
a pistol at the counter is one order.

### `order_error` → the shop, urgently

Three cases, each with `severity: "urgent"`. These want a different
subject line and probably a different colour in the sheet.

```json
{
  "kind": "order_error",
  "severity": "urgent",
  "message": "A card was charged but the order could not be saved.",
  "transaction_id": "60000123456",
  "order_number": "MLF-AFUVLU",
  "total_cents": 2299,
  "email": "dana.ruiz@example.com",
  "submitted_at": "2026-09-09T21:59:50.618Z"
}
```

| `message` | What happened | Fields carried |
| --- | --- | --- |
| `A card was charged but the order could not be saved.` | **The bad one.** Money moved and nothing recorded it. The buyer was told not to pay again and to call with the order number | `transaction_id`, `order_number`, `total_cents`, `email` |
| `Order saved but its line items did not.` | The order exists with totals but no lines | `order_number` |
| `Order <number> did not receive its <n> entries.` | The purchase earned entries that were not credited. Fixable by hand before the draw | `order_number`, `email` |

Fields not listed for a case are absent, not null — the payloads differ
in shape between the three. Read `message` to tell them apart, or check
for `transaction_id`, which only the first carries.

---

## Vercel

Required for the site to function at all:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-only, never NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL             # the receipt links are built from this
```

Required for any email at all, customer or owner:

```
GOOGLE_SCRIPT_URL
```

Optional:

```
EMAIL_PROVIDER                   # unset or apps_script (default) | resend
ORDER_EMAIL_FROM                 # only if the Google account has it as a verified alias
```

Required for payments:

```
NEXT_PUBLIC_AUTHORIZENET_ENV     # sandbox | production
AUTHORIZENET_API_LOGIN_ID
AUTHORIZENET_TRANSACTION_KEY     # server-only secret
NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY
```

`NEXT_PUBLIC_SITE_URL` matters more than it looks. The receipt link in
the confirmation email is absolute and built from it, so if it is wrong
or missing on the deployment, every customer gets a link that goes
nowhere.

Three variables exist only for local testing and must be unset in Vercel:
`AUTHORIZENET_API_BASE`, `RESEND_API_BASE` and `GOOGLE_SCRIPT_BASE`. All
three are guarded — the first is ignored in production, the other two
only accept a localhost address — but they have no business being set on
a deployment.

Check what is configured at **`/api/health`**, which reports which
provider is live and whether it has what it needs. Presence only; no key
is ever echoed.

---

## Moving the customer confirmation to Resend

When the client has a domain, verify it with Resend, then:

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_…
ORDER_EMAIL_FROM=orders@theirdomain.com
```

That is the whole change. Both paths take the same rendered HTML and
text, so nothing about the email itself moves. Owner notifications are
untouched and stay on the Apps Script — they are sheet rows first and
email second, and the sheet is what the shop works from.

Both directions are tested against the same build: flipping the variable
and restarting is the entire migration, and `/api/health` will confirm
which one is live.

**Why it is worth doing.** Two reasons, neither urgent:

- **Deliverability.** Apps Script sends from a Gmail address. A
  transactional email from `something@gmail.com` carrying an order total
  and a link is exactly the shape spam filters are suspicious of, and
  there is no SPF or DKIM alignment with the shop's own domain to
  reassure them.
- **The daily cap.** A consumer Google account is limited to about 100
  recipients a day and a Workspace account to about 1,500. Neither is a
  problem at launch volume. Both become a problem on a day the shop has
  a good run, and the failure is silent from the customer's side — they
  simply never get their receipt. The site records it (`confirmation_sent_at`
  stays null) and the `order` notification says
  `confirmation_emailed: false`, so it is visible if somebody looks.

---

## "We couldn't send the email copy"

That line is on the receipt page and means `confirmation_sent_at` is
null: the order completed and is fully recorded, and only the email did
not go.

Under Apps Script, the causes are `GOOGLE_SCRIPT_URL` unset or wrong, the
script not deployed as a web app with access set to "Anyone", the script
throwing, or the daily send cap. The reason is written to the server log
as `Order MLF-XXXXXX: confirmation not sent — <detail>`, and the detail
distinguishes them: an HTTP status, an explicit script failure, or
"unreachable".

Nothing is lost when this happens. The owner can find the orders needing
a copy sent by hand by filtering on a null `confirmation_sent_at`.
