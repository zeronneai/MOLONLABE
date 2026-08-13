# Molon Labe Firearms x SunCity Outdoors
## Website build brief

Client: Molon Labe Firearms x SunCity Outdoors (MLF x SCO)
Location: 10024 Montana Ave, El Paso, TX
Instagram: @molonlabe.fa
Hours: Mon to Fri 11:00 to 19:00 | Sat 11:00 to 18:00 | Sun 11:00 to 17:00
Brands carried: Taran Tactical, RetroRifle, Savior
Built by: Purple Roots Agency

---

## 1. What this site is

Read this first. It changes every decision downstream.

This is **not** a generic e-commerce store. It is a **digital showroom**. The shop sells in person and will keep selling in person. The website exists so that people can:

1. See what is currently on hand, in detail, with video
2. See what is currently featured in the entry program
3. Reach out, reserve, or enter, without making a phone call

The owner needs to be able to swap what is featured in under a minute from his phone, because inventory moves fast.

**Terminology rule, non negotiable:** never use the words "raffle", "lottery", or "rifa" anywhere in code, copy, routes, database tables, or comments. The public term is **sweepstakes**. Internally use `entryProgram`, `entries`, `entrants`, `prize`.

---

## 2. Stack

- Next.js 15+ (App Router), TypeScript, React Server Components where sensible
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage) for data and admin auth
- Cloudinary for product imagery (already in use, see section 8)
- Vercel for hosting
- `framer-motion` for transitions
- Canvas 2D for the intro game (no game engine, no heavy dependency)

Do not add a CMS. The admin portal we build IS the CMS.

---

## 3. Visual direction

Dark, tactical, premium. Closer to a watch brand than a sporting goods store.

```
--ink:        #0B0A0C   /* page background */
--surface:    #131417   /* cards, panels */
--surface-2:  #1B1D21   /* raised */
--bone:       #F2EFE7   /* primary text */
--muted:      #8A8B8F   /* secondary text */
--acid:       #57B94A   /* accent, from the logo goggles */
--acid-dim:   #2E5F28
--danger:     #C6472F   /* used sparingly */
```

Typography: **Archivo** (weights 400/600/800) for everything. Display headlines at 800 with tight negative tracking (-0.03em to -0.04em). Small labels at 600, uppercase, letter-spacing 0.28em. Big size contrast is the whole aesthetic: headlines are huge, labels are tiny.

Rules and hairlines instead of drop shadows. Sharp corners or a maximum 2px radius. No gradients except on image scrims.

The logo is the Day of the Dead sugar skull with camo goggles. Green lenses. Place the transparent PNG in `/public/brand/logo-skull.png`.

---

## 4. The intro experience (build this first, it sets the tone)

A full-screen pixel-art shooting gallery that appears on first visit before the site is revealed.

### Behaviour

- Full viewport overlay, `--ink` background, subtle CRT scanline overlay at very low opacity
- Pixel-art alien head sprites, styled after the green alien reference: chunky pixels, green head, large black almond eyes. Draw them programmatically on canvas or use a sprite sheet at `/public/game/alien.png`. Render with `imageRendering: pixelated`, never smoothed
- **Exactly 4 aliens**, each drifting on its own path (sine wave drift, varied speed and amplitude, bounce off the viewport bounds)
- Prompt text centered above the play area, pixel-styled: **"DO YOU HAVE WHAT IT TAKES?"** and beneath it, smaller: **"HIT ALL FOUR"**
- The cursor becomes a crosshair reticle (hide the native cursor, draw the reticle on canvas)
- Click or tap on an alien = hit. Play a short muted-by-default click sound only if the user has interacted. Hit aliens burst into a pixel particle scatter and their counter increments
- A counter in a corner: `0 / 4`
- When the fourth alien is hit, a brief flash, the overlay wipes away (fast, 400ms, a hard horizontal wipe rather than a fade), and the site is revealed
- A **SKIP** control in the top right, always visible, always tappable, minimum 44x44px hit area. Label it `SKIP ✕`
- Once completed or skipped, persist in `localStorage` under key `mlf_intro_seen` so returning visitors go straight to the site. Add `?intro=1` to the URL to force it for demos

### Input

- Mouse: `pointerdown` on canvas, hit test against alien bounding boxes
- Touch: same `pointerdown` handler, but grow the hit boxes by roughly 40% on coarse pointers (`matchMedia('(pointer: coarse)')`). On touch, do not draw the crosshair, draw a hit ripple at the tap point instead
- Keyboard: `Esc` skips. Ensure the skip button is focusable and the overlay traps focus while open

### Accessibility and performance

- Respect `prefers-reduced-motion`: if set, skip the game entirely and go straight to the site
- Pause the animation loop when the tab is hidden (`visibilitychange`)
- Cap at 60fps via `requestAnimationFrame`, use a fixed timestep for movement so speed is consistent across refresh rates
- Do not block the rest of the page from loading behind the overlay. The site should be fully rendered and ready underneath

Keep the whole thing in `components/intro/IntroGame.tsx` with the drawing logic in `lib/game/`. It must be removable in one line if the client ever changes their mind.

---

## 5. Routes

```
/                     Home
/inventory            Grid of what is on hand, filterable
/inventory/[slug]     Detail page: gallery, embedded video, specs, inquire CTA
/featured             Entry program hub: current prize, entry info, past winners
/transfers            FFL transfer intake form
/services             Range, classes, gunsmithing, whatever they offer
/visit                Hours, map, directions, contact
/admin                Owner portal (auth required)
/admin/inventory
/admin/featured
/admin/inquiries
/admin/entrants
```

### Home page sections, in order

1. Hero: dark, cinematic, video background loop if available or a hero still. Headline plus two CTAs: `VIEW INVENTORY` and `CURRENT FEATURE`
2. Currently featured: the active entry-program item, large, with a live entry counter and a countdown to close
3. Fresh arrivals: 4 to 6 inventory cards, pulled from the DB, sorted by newest
4. The shop: a short piece about MLF x SCO with a photo of the storefront and the ceiling install
5. Brands carried: Taran Tactical, RetroRifle, Savior, laid out as a type-only strip
6. Visit: hours, address, map embed, click-to-call and click-for-directions buttons
7. Footer: logo, hours, socials, compliance line

---

## 6. Data model (Supabase)

```sql
-- inventory items
create table items (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  category      text not null,          -- pistol | rifle | revolver | pcc | optic | accessory
  brand         text,
  short_desc    text,
  long_desc     text,
  specs         jsonb default '{}'::jsonb,   -- freeform key/value pairs
  price_display text,                    -- string, so the owner can write "Call for price"
  status        text not null default 'available', -- available | reserved | sold | hidden
  is_featured   boolean default false,   -- appears in the entry program feature slot
  sort_order    int default 0,
  images        jsonb default '[]'::jsonb,  -- array of Cloudinary URLs
  video_url     text,                    -- direct mp4 or an embed URL
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- the entry program
create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  item_id       uuid references items(id),
  description   text,
  opens_at      timestamptz,
  closes_at     timestamptz,
  status        text not null default 'draft', -- draft | live | closed | awarded
  winner_note   text,
  created_at    timestamptz default now()
);

create table entrants (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references campaigns(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  entry_count   int not null default 1,
  source        text default 'online',   -- online | in_store | mail
  created_at    timestamptz default now()
);

-- general inquiries and transfer requests
create table inquiries (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,           -- item | transfer | general | service
  item_id       uuid references items(id),
  name          text not null,
  email         text not null,
  phone         text,
  message       text,
  status        text not null default 'new', -- new | contacted | closed
  created_at    timestamptz default now()
);
```

RLS: public read on `items` where `status <> 'hidden'`, and on `campaigns` where `status = 'live'`. Everything else authenticated only. Inserts on `inquiries` and `entrants` allowed from anon via a server action, never direct from the client.

---

## 7. Admin portal

Supabase Auth, email and password, a single owner account to start. Route group `/admin` behind middleware.

It must be **usable one-handed on a phone while standing behind a counter**. That is the design constraint. Large tap targets, no dense tables on mobile, card layout that collapses cleanly.

Screens:

- **Inventory**: list with search and status filter. Add, edit, duplicate, archive. Toggle `status` and `is_featured` with a single tap from the list, no need to open the record. Drag to reorder, or a simple up/down control
- **Image upload**: direct to Cloudinary via an unsigned upload preset, then store the returned secure URL in `items.images`. Show thumbnails, allow reorder and delete
- **Featured**: pick the active campaign, set open and close dates, see the live entrant count, export entrants to CSV
- **Inquiries**: queue with status toggles. New items visually distinct
- **Entrants**: searchable list, CSV export

---

## 8. Catalog seed data

Use these four Cloudinary URLs to seed the inventory so there is something real to look at:

```ts
export const seedItems = [
  {
    slug: "nighthawk-custom-revolver",
    name: "Nighthawk Custom Revolver",
    category: "revolver",
    brand: "Nighthawk Custom",
    short_desc: "Ported barrel, hand-fitted action, walnut target grips.",
    price_display: "Call for price",
    images: ["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Revolver_on_black_velvet_2K_202608061301_boa0qr.jpg"],
  },
  {
    slug: "competition-pistol-red-dot",
    name: "Competition Pistol, Red Dot Equipped",
    category: "pistol",
    short_desc: "Optic-ready slide with a mounted red dot and extended magwell.",
    price_display: "Call for price",
    images: ["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Pistol_with_red_dot_optic_202608061301_ggybgq.jpg"],
  },
  {
    slug: "taran-tactical-glock",
    name: "Taran Tactical Glock",
    category: "pistol",
    brand: "Taran Tactical",
    short_desc: "TTI slide work, stippled frame, extended base pad.",
    price_display: "Call for price",
    images: ["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Pistol_on_black_granite_2K_202608061302_zzzmjb.jpg"],
  },
  {
    slug: "sig-mpx-carbon",
    name: "SIG MPX, Carbon Handguard",
    category: "pcc",
    brand: "SIG Sauer",
    short_desc: "Folding brace, carbon fiber handguard, enclosed red dot.",
    price_display: "Call for price",
    images: ["https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Firearm_on_textured_surface_2K_202608061302_ln1qnw.jpg"],
  },
];
```

Serve them through `next/image` with a Cloudinary loader so transforms (`f_auto,q_auto,w_`) are applied. Add `res.cloudinary.com` to `next.config` remote patterns.

---

## 9. Inventory detail page

This page is the product. Give it room.

- Full-bleed image gallery on the left or top, sticky on desktop while the specs scroll
- Embedded video directly under the gallery, not linked out. Lazy load with a poster frame. Native `<video>` with `playsInline`, `muted`, and controls
- Specs rendered from the `specs` jsonb as a definition list with hairline rules
- Status chip: available, reserved, sold
- Primary CTA: `INQUIRE ABOUT THIS` opens a form drawer that posts to `inquiries` with `item_id` prefilled
- Secondary: click-to-call and a WhatsApp link
- Below: "More like this" from the same category

---

## 10. Forms and notifications

All form posts go through Next.js server actions with zod validation and a honeypot field. On success, write to Supabase, then POST the payload to a Google Apps Script web app endpoint stored in `GOOGLE_SCRIPT_URL`. That script appends a row to a Google Sheet and sends the owner an email. This is the same pattern we already run on other builds, so reuse it rather than adding an email vendor.

Fire a GA4 event on every successful submit.

---

## 11. Analytics

GA4 from launch, with custom events. Do not rely on enhanced measurement alone, it does not reliably catch `tel:` links.

```
view_item          { item_slug, item_name, category }
inquiry_submit     { type, item_slug }
click_to_call      { source }        // header | detail | footer | sticky
whatsapp_click     { source }
entry_start        { campaign_id }
entry_submit       { campaign_id }
transfer_submit    {}
video_play         { item_slug }
intro_completed    { hits, elapsed_ms }
intro_skipped      { elapsed_ms }
```

Mark `inquiry_submit`, `entry_submit` and `click_to_call` as key events. Ship a `lib/analytics.ts` with a typed `track()` wrapper so events cannot drift.

---

## 12. Payments

**Do not build checkout in this phase.** Fortis integration is Phase 2 and needs a compliance conversation with the client's Fortis representative first, because processors restrict regulated categories.

What to do now: structure the cart and order code so a payment provider can be dropped in later. Put a `lib/payments/provider.ts` interface with a stub implementation. Leave `FORTIS_*` variables in `.env.example` commented out.

---

## 13. Compliance and legal copy

- Age gate on first visit (after the intro game): a simple modal, "Are you 21 or older?", persisted in `localStorage`. Not a hard legal control, but expected in this category
- Footer disclaimer: all firearm sales are conducted in person through a licensed dealer, subject to federal, state and local law, with all required background checks and waiting periods
- No prices in a cart, no "buy now" language on firearm listings. The CTA is inquiry or reservation
- Sweepstakes pages must link to a full rules page including a no-purchase entry method. Leave the rules copy as a placeholder marked `TODO: client attorney to supply`

---

## 14. SEO and performance

- Metadata API per route, OG images generated with `next/og`
- `LocalBusiness` and `Product` JSON-LD structured data
- `sitemap.ts` and `robots.ts`
- Target LCP under 2.5s on 4G. The intro game must not block LCP: render the underlying page first, mount the overlay after hydration
- Bilingual ready: keep all copy in `content/en.ts` and `content/es.ts` and read through a small `t()` helper, even if Spanish ships later

---

## 15. Build order

1. Repo scaffold, Tailwind tokens, fonts, layout shell, header and footer
2. Intro game, fully working on mouse and touch, with skip
3. Home page with hardcoded content
4. Supabase schema, seed the four items, inventory list and detail pages
5. Forms, server actions, Google Apps Script notification
6. Admin auth and the inventory screen, then featured, inquiries, entrants
7. Entry program pages and the entrant flow
8. Analytics, SEO, structured data, OG images
9. Polish: motion, empty states, 404, loading skeletons

Commit at each numbered step. Do not move on until the previous step runs cleanly on `npm run build`.

---

## 16. Definition of done for this phase

- Intro game works with mouse, touch and keyboard, skips cleanly, never shows twice
- All four seed items render with real images from Cloudinary
- Owner can log in, add an item, upload an image, and toggle it featured, all from a phone
- Every form writes to Supabase and sends the owner an email
- Lighthouse: performance 90+, accessibility 95+, SEO 100 on the home page
- No occurrence of the words raffle, lottery, or rifa anywhere in the repo
