# Admin access — decisions (apply in step 6)

Agreed 2026-08-08. These override any defaults.

1. **No public link to `/admin` anywhere.** No footer link, no nav item,
   nothing. The owner bookmarks the URL.
2. **Auth: Supabase magic link only.** No password flow, no signup route.
   The owner account is created manually in the Supabase dashboard.
   Unauthenticated `/admin` shows a minimal login screen: skull logo, one
   email field styled per DESIGN.md section 5 (underline only, 56px tall,
   acid focus underline), one bordered CTA. Nothing else on the page.
3. **Session persistence: 30 days.** Cookie max-age 30 days; rely on
   refresh-token rotation so the owner is not re-authenticating
   constantly. Middleware guards `/admin/*` and redirects
   unauthenticated requests to the login screen.
4. **Installable admin.** Web app manifest scoped to `/admin`
   (`start_url: /admin`, `display: standalone`), name "MLF Admin", skull
   logo as the icon (192/512 via Cloudinary transforms), so the owner can
   install it to a phone home screen and it opens without browser chrome.
