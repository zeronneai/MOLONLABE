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
