# Admin access — decisions (applied in step 6)

Agreed 2026-08-08; auth method revised 2026-08-11. These override any
defaults.

1. **No public link to `/admin` anywhere.** No footer link, no nav item,
   nothing. The owner bookmarks the URL.
2. **Auth: Supabase email + password.** (Revised from magic link, which
   failed on Vercel preview URLs absent from Supabase's redirect
   allow-list — password auth has no redirect step.) No signup route, no
   password-reset link on the page; the owner account and any password
   change are handled manually in the Supabase dashboard.
   Unauthenticated `/admin` shows a minimal login screen: skull logo,
   email and password fields styled per DESIGN.md section 5 (underline
   only, 56px tall, acid focus underline), one bordered CTA. Nothing
   else on the page. Failures show one generic "Incorrect email or
   password" — never which field was wrong. Client-side lockout after 5
   failed attempts (60s), with Supabase auth rate limits as the real
   backstop. Autocomplete attributes set so phone password managers
   offer to save.
3. **Session persistence: 30 days.** Cookie max-age 30 days; refresh
   token rotation keeps the owner signed in. Middleware guards
   `/admin/*` and redirects unauthenticated requests to the login
   screen. Because sessions are long-lived on a device that may sit on
   a counter, a visible Sign out control stays in the admin top bar.
4. **Installable admin.** Web app manifest scoped to `/admin`
   (`start_url: /admin`, `display: standalone`), name "MLF Admin", skull
   logo as the icon (192/512 via Cloudinary transforms), so the owner can
   install it to a phone home screen and it opens without browser chrome.
5. **Two accounts, so the log can name a person.** Two people work in
   here — the agency and the shop — and until now nothing recorded which
   of them changed a price. Every write to an item, a campaign or a
   setting is now stamped with who made it, and the consequential ones
   land in Admin → Activity with their previous value.

   **This needs one manual step per account, and without it the log is
   useless.** Supabase carries a person's name in `user_metadata`, which
   is empty unless somebody fills it in. In the Supabase dashboard, go to
   Authentication → Users → the user → *User Metadata*, and add:

   ```json
   { "full_name": "Rey Marquez" }
   ```

   Until that is set the log reads `Unnamed (9f1c0d)` — the account is
   still distinguishable, and the six characters are the start of the
   user id, which is meaningless to anyone reading over a shoulder.

   **Never the email address.** Not in the log, not in the item footer,
   not in a tooltip. A mailbox in an audit trail is a mailbox in every
   export of that table, and none of this is ever rendered outside the
   admin. `displayName()` in `lib/admin/audit.ts` is the only thing that
   turns a user into a string, and it has no path that returns an email.

   Authorship cannot be set from the browser. The ids are stamped by a
   database trigger from `auth.uid()`, so a hand-crafted request cannot
   forge them; the display names are written by the server action from
   the session, and no action reads a name out of the submitted form.

---

# When a card is charged and the order does not save

The shop gets an email with the subject **"URGENT: card charged, order
NOT saved"**. It is the only message the site sends where waiting costs
money, and it is rare enough that whoever reads it will never have seen
one before. The full steps are printed inside that email so they are
there when it is needed. They are here as well so they survive the email
being deleted, the Apps Script being rewritten, or the owner asking
somebody else what to do.

## What has actually happened

Authorize.net approved the card and took the money. Writing the order to
the database failed immediately afterwards, so there is no order record —
no line items, no receipt, nothing in the admin. The customer saw the
order number and was told not to pay again and to call the shop.

**The stock is already held.** Checkout claims stock *before* charging
the card, and this failure path deliberately does not release it: the
customer paid, so the goods stay theirs until a person decides
otherwise. A single item sits at `reserved`; a size has had its stock
decremented. Both are invisible to shoppers until somebody changes them.

## The steps

1. **Check the admin first.** Search Orders for the order number. If it
   is there, the write recovered on its own — nothing to fix.

2. **Find the money in Authorize.net.** Sign in to the Merchant
   Interface and search transactions for the transaction ID in the
   email; failing that, by date and amount. The status decides what is
   possible:

   - **Unsettled / pending settlement** — the daily batch has not closed.
     The transaction can be **voided**, and a void usually means the
     customer never sees the charge on their statement at all.
   - **Settled successfully** — the batch has closed. Voiding is no
     longer possible and a **refund** is the only route back. It needs
     the card's last four digits and takes a few days to appear.

   Do not act yet. Step 3 first.

3. **Call the customer before deciding.** They paid and they are
   waiting, and this is their call, not ours.

   - **They still want it and we still have it** — keep the money and
     write the order up by hand as a counter sale. A firearm still needs
     its background check at collection like any other.
   - **They do not, or it is gone** — void if unsettled, refund if
     settled. Tell them which, and roughly when the money returns.

4. **Put the stock back, but only if you voided or refunded.** Set a
   reserved item back to Available; add the quantity back to the size.
   Skipping this leaves the item unsellable on the site indefinitely, and
   nothing will remind anybody.

5. **Write down what happened.** Order number, transaction ID, and
   whether it was kept, voided or refunded. Nothing else recorded this
   sale, so that note is the only record it existed.

## Who to call

- **The customer** — their address is in the email.
- **Authorize.net merchant support** — the number is on the merchant
  statement and on the Support page inside the Merchant Interface. We
  have deliberately not printed a number here that we cannot verify.
- **Purple Roots** — even after it is fixed, so the cause can be found.
  The email prints `AGENCY_CONTACT` from `lib/brand.ts`, which is still
  a placeholder until the real number is supplied.

## The two lesser alerts

The same subject prefix, far less urgent, and neither involves money
moving incorrectly:

- **"order saved without its items"** — the order and its totals exist
  but the list of what was bought did not write. The customer's
  confirmation email has the list; copy it onto the order by hand. No
  refund is involved.
- **"did not get its entries"** — the sale is fine; the sweepstakes
  entries it earned were not credited. Add them by hand under Entrants
  against the customer's email. It has to happen before the drawing,
  because after the draw it cannot be put right.

## What has not been verified

The Authorize.net steps describe void-before-settlement and
refund-after-settlement, which is how card processing works and is not
specific to their interface. **The exact menu labels and screen names in
the current Merchant Interface have not been checked against a live
account** — nobody here has one. Worth walking through once with the
client's real login before launch, and correcting the wording in
`lib/notify.ts` and here if anything is named differently.
