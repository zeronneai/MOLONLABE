# Punch list — what is left before launch

Audited against `PROJECT_BRIEF.md` and `DESIGN.md` after step 9.
Everything in build order steps 1–9 is implemented and building; what
follows is what is genuinely incomplete, stubbed, or waiting on someone.

---

## 1. Blocking — the site should not go live without these

### 1.1 ~~Age gate~~ — DONE
Built in `components/compliance/AgeGate.tsx`, gated on the intro game
resolving so the two never stack. Confirmation persists under
`mlf_age_ok`; a decline is deliberately not persisted so a mistap is
recoverable.

### 1.2 Sweepstakes rules copy — PLACEHOLDER
`/sweepstakes-rules` is scaffolding: a section checklist, not operative
terms, marked for the client's attorney and `noindex`. The entry program
must not open to the public until real rules replace it. **Owner action:
attorney.**

### 1.3 Real content passes
Everything the client owns is still ours-by-default:
- Entry pack prices (`lib/payments/index.ts`) — $25 / $50 / $100 invented
- Services page copy — written from the brief's one-line description
- The shop story on the home page
- Whether the sweepstakes even opens with entry packs at all
**Owner action: client.**

### 1.4 Lighthouse verification (brief §16) — UNVERIFIED, INSTRUCTIONS WRITTEN
Targets are performance 90+, accessibility 95+, SEO 100 on home. Still
never measured — the sandbox cannot reach Cloudinary. See
`docs/lighthouse.md` for how to run it, which visit to measure, and which
failures are expected costs of the hero and the game rather than defects.

---

## 2. Waiting on a third party

### 2.1 Payments (brief §12) — STUBBED BY DESIGN
`lib/payments/index.ts` defines the provider interface; the live provider
reports `configured: false`, entry packs render disabled, and nothing can
take money. Fortis needs the compliance conversation first. Bringing it
online is one object plus wiring `entry_method: "purchase"` through the
existing entrant insert. `FORTIS_*` are commented out in `.env.example`.

Note: the brief asks for `lib/payments/provider.ts`; ours is
`lib/payments/index.ts`. Rename if the exact path matters.

### 2.2 WhatsApp — OFF BEHIND A FLAG
`WHATSAPP_ENABLED = false` in `lib/brand.ts`. Confirm with the shop
whether (915) 497-0541 actually has WhatsApp; if it does, flip the flag
and the CTAs return.

### 2.3 ~~Hero clip durations~~ — MEASURED, NOT ASSUMED
`lib/hero/duration.ts` reads the real duration from Cloudinary's
`fl_getinfo` at request time (cached hourly) and passes it to the scrub.
`HERO_CLIPS.seconds` is now only a fallback; a mismatch logs a warning
naming the constant to fix, and an unreachable endpoint logs loudly and
falls back rather than silently truncating the scrub.

Still worth confirming once on the preview: that `fl_getinfo` is enabled
for this Cloudinary account. It is a standard delivery flag, but I could
not reach Cloudinary from the sandbox to prove it. If it 404s you will
see `[hero] could not measure` in the Vercel logs — send me the real
durations and I will set the constants.

---

## 3. Deviations from the brief — deliberate, listed so nobody is surprised

| Brief says | We shipped | Why |
| --- | --- | --- |
| §7 image upload direct to Cloudinary via unsigned preset | Supabase Storage, bucket `product-images` | Client asked for it mid-build; unsigned presets also let anyone upload to the account |
| §3 logo at `/public/brand/logo-skull.png` | Cloudinary `LOGO_URL` in `lib/brand.ts` | One transform pipeline for all imagery; nothing references a local file |
| §4 intro game: 4 drifting pixel aliens | Whack-a-mole over photographed art, DB-tuned difficulty | Client rewrote the spec twice; current version is what was approved |
| §5 `/featured` "past winners" | Present, but the section hides itself until a winner exists | An empty winners grid on day one looks broken |
| §1 buttons: transparent bordered rectangles | Machined control system, semantic colour | Client approved the replacement; `DESIGN.md` §1 and §8 rewritten to match |

---

## 4. Known limitations

### 4.1 Soft 404 on unknown item slugs
`/inventory/anything-invalid` renders the 404 screen but returns HTTP
200. The segment is dynamically rendered, so Next commits the status with
the first streamed chunk, before `notFound()` resolves. It is served
`noindex`, so it will not be indexed. A hard 404 needs
`generateStaticParams` with `dynamicParams: false` (which hides items
added since the last build) or an existence check in middleware.
Documented at the top of `app/(site)/inventory/[slug]/page.tsx`.

### 4.2 Spanish (brief §14) — NOT STARTED, SCOPED
370 user-visible strings across 66 files: 215 public, 145 admin, 10 in
the game. `content/en.ts` holds only hero copy and the shared
`IN_THE_CASE` headline. See `docs/i18n-estimate.md` for the count by
area, the proposed approach and the effort.

### 4.3 Game spawn anchors are still positional guesses
The dark-drop strength is now measured from the background at runtime, so
a pale alien over a lit case fixes itself. But *where* the anchors sit —
`SPAWN_ANCHORS_DESKTOP` / `_MOBILE` in `lib/game/assets.ts` — was set
against stand-ins, never against the real showroom photo. Worth one pass
on a real device.

### 4.4 Verification is against a mock
Every suite in this build runs against a hand-written Supabase stand-in,
because the real project is unreachable from the build sandbox. RLS
policies are approximated, not executed. The policies themselves have
never been exercised against Postgres.

---

## 5. Owner setup still outstanding

1. Apply migrations in order — several may already be done:
   `20260808120000_initial_schema` → `20260810090000_storage_product_images`
   → `20260810091000_revoke_anon_inserts` (only after the service key is
   set) → `20260812100000_settings_and_game_events` →
   `20260812150000_restrict_item_references` →
   `20260812160000_entry_program`
2. Create the single owner account in Supabase Auth. There is no signup
   route by design.
3. Set `GOOGLE_SCRIPT_URL`, or form notifications silently do not send
   (submissions still save).
4. Mark the four key events in GA4 — `inquiry_submit`, `click_to_call`,
   `entry_submit`, `transfer_submit`. Nothing we ship can set that flag;
   see `docs/analytics.md`.
5. ~~Confirm the shop's address and hours~~ — done. Address, suite,
   postcode and hours in `lib/brand.ts` are confirmed by the client.

---

## 6. Verified working

For contrast, these were tested end to end rather than eyeballed:
admin across all five screens at phone width (30 checks), archive and
delete including bucket cleanup (20), the entry program and the free
route (25), SEO, structured data, sitemap, OG and GA4 event firing (25),
public forms including the honeypot (8), and step 9's empty states, error
screens, skeletons and backdrop measurement (22).
