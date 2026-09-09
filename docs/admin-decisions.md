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
