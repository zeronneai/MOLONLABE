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
| Every owner-facing payload has | `summary` — pre-rendered plain text, ready to print |

Two things the script must honour:

1. **Nothing needs formatting.** The customer's email arrives already
   rendered — `kind: "order_confirmation"` carries finished `html` and
   `text`, send them as they are. Every owner-facing kind carries
   **`summary`**, a plain-text block written to be printed as the body of
   the owner's email with no assembly at all. Both exist so there is one
   opinion about wording and about which fields matter, and it lives
   where it can be tested. A script that rebuilds either is a second copy
   to keep in step.

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
  "summary": "FFL TRANSFER REQUEST\nAlma Cortez · alma.cortez@example.com · (915) 555-0142",
  "submitted_at": "2026-09-09T21:59:47.493Z"
}
```

`summary` opens with the request type in words — ITEM ENQUIRY, FFL
TRANSFER REQUEST, GENERAL MESSAGE or SERVICE REQUEST — then who it was,
then the item if there is one, then the message.

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
  "summary": "FREE ENTRY — September Rifle Giveaway\nMarco Peña · marco.pena@example.com · (915) 555-0188\n\nNo purchase. One entry.",
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
  "order_number": "MLF-FB259M",
  "name": "Dana Ruiz",
  "email": "dana.ruiz@example.com",
  "phone": "9155550100",
  "subtotal_cents": 223100,
  "tax_cents": 18406,
  "shipping_cents": 1000,
  "total_cents": 242506,
  "card_brand": "Visa",
  "card_last4": "1111",
  "ships": ["Molon Labe Tee"],
  "collects": ["SIG MPX Carbon"],
  "ship_lines": [
    { "name": "Molon Labe Tee", "size": "Medium", "quantity": 1, "line_total_cents": 3200 }
  ],
  "pickup_lines": [
    { "name": "SIG MPX Carbon", "size": null, "quantity": 1, "line_total_cents": 219900 }
  ],
  "entries_awarded": 2231,
  "campaign": "September Rifle Giveaway",
  "confirmation_emailed": true,
  "summary": "NEW ORDER — MLF-FB259M\nDana Ruiz · …",
  "submitted_at": "2026-09-10T14:52:53.864Z"
}
```

`summary` renders as:

```
NEW ORDER — MLF-FB259M
Dana Ruiz · dana.ruiz@example.com · (915) 555-0100

COLLECT AT SHOP
  SIG MPX Carbon — $2,199.00

SHIPS
  Molon Labe Tee, Medium — $32.00

Subtotal $2,231.00 · Tax $184.06 · Shipping $10.00
Total $2,425.06 · Visa ending 1111

Earned 2231 entries in September Rifle Giveaway.

Background check due at pickup.
```

| Field | Notes |
| --- | --- |
| `*_cents` | Integer cents. `242506` is $2,425.06 |
| `phone` | **As the customer typed it.** The summary formats it; the field is raw, so the sheet keeps what was actually entered |
| `ships` / `collects` | Item names only. Unchanged, for the sheet columns that already exist |
| `ship_lines` / `pickup_lines` | The same lines with size, quantity and price. What the summary is built from |
| `entries_awarded` | This order only, not the running total |
| `confirmation_emailed` | `false` means the customer has no copy. The summary says so in words too |

`ships`/`collects` duplicate what is in `ship_lines`/`pickup_lines` and
are kept only so the existing sheet does not break. They can go once its
columns read the detailed arrays.

An order can have both — an optic in the post and a pistol at the counter
is one order. **A non-empty `collects` means somebody is driving to the
shop and a background check is due**, which is why the summary ends with
that line.

### `order_error` → the shop, urgently

Three cases, each with `severity: "urgent"` and a `failure` field naming
which. **Read `failure`, not `message`** — the message is prose and the
three payloads differ in shape.

```json
{
  "kind": "order_error",
  "severity": "urgent",
  "failure": "charged_not_saved",
  "message": "A card was charged but the order could not be saved.",
  "order_number": "MLF-QQLQR6",
  "transaction_id": "60000344344",
  "total_cents": 2299,
  "email": "dana.ruiz@example.com",
  "summary": "!!!!!!!!!!…",
  "submitted_at": "2026-09-10T14:55:02.118Z"
}
```

| `failure` | What happened | Extra fields |
| --- | --- | --- |
| `charged_not_saved` | **The bad one.** Money moved and nothing recorded it | `transaction_id`, `total_cents`, `email` |
| `lines_not_saved` | The order exists with totals but no line items | — |
| `entries_not_awarded` | The purchase earned entries that were not credited | `email`, `entries_awarded` |

The `charged_not_saved` summary is deliberately impossible to skim past:

```
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!  A CARD WAS CHARGED AND THE ORDER WAS   !!
!!  NOT SAVED. NOTHING RECORDED THIS SALE. !!
!!  ACT NOW.                               !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

----------------------------------------------
A card was charged but the order could not be saved.
----------------------------------------------

Order number  MLF-QQLQR6
Charged       $22.99
Transaction   60000344344
Customer      dana.ruiz@example.com

The customer has been told not to pay again and to call
with this order number. The money is at the gateway and
the order is not in the database. Find the transaction in
Authorize.net and write the order up by hand.
```

The other two open with `!! URGENT — SOMETHING DID NOT RECORD !!` and
carry the same shape: what happened, then what to do about it.

**Worth doing in the script:** give `kind: "order_error"` its own subject
line and its own colour in the sheet, and consider a separate recipient
or an SMS for `failure: "charged_not_saved"`. It is the only message here
where a delay costs the shop money.

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
