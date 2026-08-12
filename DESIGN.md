# DESIGN.md
## Composition rules for the MLF x SCO build

Read this alongside `PROJECT_BRIEF.md`. The brief defines **what** to build and which tokens to use. This file defines **how it is composed**, which is the part that decides whether the site looks expensive or looks like a Tailwind template with different colours.

If these two documents ever conflict, this one wins on layout and the brief wins on functionality.

---

## 0. Brand assets

Logo, transparent PNG, already hosted:

```
https://res.cloudinary.com/dsprn0ew4/image/upload/v1786206690/molon-labe-logo-transparent_fvttuz.png
```

Add it to `lib/brand.ts` as `LOGO_URL` and reference it from there, never inline.

Where the logo is used:

- **Header**: 30px tall, left aligned, next to the wordmark `MLF × SCO` set in Archivo 800 at 13px with `-0.02em` tracking. The skull is the mark, the wordmark is the name. Do not put the full business name in the header
- **Intro game**: on the fourth hit, the white flash resolves into the skull at the centre for roughly 250ms before the wipe fires. That is the handoff from game to site
- **Footer**: 46px tall, top left of the footer block
- **Favicon and OG images**: generate from the same file
- **Nowhere else.** The logo does not get repeated as a watermark, a background pattern, or a giant centered hero element. Restraint is the point

---

## 1. The rules that prevent the generic look

Every one of these is a decision that a default build gets wrong.

**No centered page layouts.** The site has a strong left margin and content hangs from it. Headlines start at the left rule and run right. Centering is reserved for exactly one thing: the intro game.

**No card grids for inventory.** See section 3. This is the single biggest difference between this site and every other gun shop site.

**Sections do not share a height.** A section is as tall as it needs to be. One might be 40vh, the next 90vh. Equal-height stacked sections are what makes a page feel like a template.

**Rules, not shadows — in content.** Hairlines at 0.5px `--muted` at 22% opacity separate content. Nothing in a content area ever floats: no drop shadow anywhere on the site, ever. Controls are the one exception, and only with *inset* shadows — see the control system below. An element must never appear lifted off the page.

**Corners: 0px in content, 2px maximum on controls.** No `rounded-lg` anywhere. Content is square. Controls take a 2px radius, which is the largest that still reads as machined rather than soft. The status chip stays a pill because it needs to read as a chip.

**Type does the work.** Headline 800 weight, `clamp(2.5rem, 6vw, 5.5rem)`, tracking `-0.035em`, `line-height: 0.92`. Labels 600 weight, 11px, `letter-spacing: 0.28em`, uppercase, `--muted`. The gap between those two sizes IS the design. Nothing between 14px and 40px should appear in a headline position.

**Images bleed.** Any image that is not a product thumbnail runs to at least one page edge. Images floating inside padded containers with rounded corners is the default look we are avoiding.

**Green is a scalpel.** `--acid` appears on: active nav state, status chips, entry counters, form focus rings, the small labels above sections, and exactly one filled button per view. Never as a large area, never as text on a light background, never on two buttons in the same view.

### The control system

Depth through material, not skeuomorphism. These are machined metal controls on a piece of equipment, not glossy web buttons. No large radii, no glow, no drop shadows floating an element off the page, no gradients as decoration.

**Tokens.**

```
--surface-raised: #1F2227    --edge-light: rgba(255,255,255,0.10)
--surface-sunken: #131418    --edge-dark:  rgba(0,0,0,0.55)
--steel:          #3A4048    --acid:       #57B94A
--amber:          #C08A2E    --acid-deep:  #2E5F28
--danger:         #C6472F
```

**Button anatomy.** Solid `--surface-raised` fill, 1px `--steel` border, a 1px inset highlight along the top edge in `--edge-light`, a 1px inset shadow along the bottom in `--edge-dark`. That top-light bottom-dark pair is what reads as a physical surface. Radius 2px maximum, 56px tall (44px for the compact `.control-sm` used in rows and toggles). On hover the fill lifts one step and the border takes the semantic colour. On press the element translates down 1px and the edges invert, so it genuinely depresses. Class: `.control` (and `.cta-primary`, which is the same material).

**Fields are the inverse.** `--surface-sunken` fill with an inset shadow along the top edge, so inputs read as recessed while buttons sit proud. That contrast is most of the effect. The underline stays — it is still the field's identity and where focus reads, in `--acid`. This supersedes the underline-only description in section 5.

**Noise.** A ~2% fractal-noise tile sits over every raised surface, generated as an inline SVG data URI. It kills the flat digital look at no request cost.

**Semantic colour, one meaning each.**

- **Acid** is confirm and go: the single primary action on a screen, and the `available` status. Exactly one acid *fill* per view, never two. Selected status segments take acid as border and text, not as a fill — the fill is reserved for the primary action.
- **Amber** is caution and pending: `reserved` status, unsaved changes, an expiring offer, a `new` inquiry.
- **Danger** is destructive only: delete, and the `sold` status. Never decorative.
- **Steel** is everything else: secondary actions, neutral controls. Archive is steel; save is acid; delete is danger.

**Where it applies.** Everywhere an interactive element exists: CTAs, form
submits, admin row actions and filters, status switches, the intro game's
buttons, and the entry program. Drop zones and readouts use
`.field-well`, the sunken panel.

**Filters are split, deliberately.** In the admin they are steel controls:
that panel is a working tool used one-handed, and a control that depresses
is easier to hit and read than a line of text. On the public inventory
index they stay plain text labels with an underline on the active one, per
section 3 — that page's strength is its restraint, and a row of metal
buttons above the editorial rows competes with them. Do not "fix" the
inconsistency by unifying them; the two contexts want different things.

**Secondary CTA** stays text with a 6px underline offset — it is a link, not a control. If it reads as an action rather than a link, it is a steel control instead.

**The one-acid rule in practice.** Home: the hero CTA. Detail: `INQUIRE ABOUT THIS`. Any form: its submit. Admin list: `+ Add` / `+ New`. Admin record: Save. Lose card: Retry. `VisitSection` takes a `primary` prop because it appears both on home, where the hero owns the acid, and on `/visit`, where calling is the point.

---

## 2. Home page

Build in this exact order, top to bottom. Note the deliberate asymmetry.

**A. Hero — scroll-scrubbed sequence** *(revised 2026-08-12; supersedes the original video-loop hero)*
A sticky full-viewport canvas scrubs through ~100 Cloudinary-extracted stills of the scope-view clip (`so_<seconds>` frame extraction against the video resource — never ship the video; scrubbing `currentTime` stutters on iOS). Scroll-driven, never scroll-hijacked: the scrub consumes ~150vh of scroll on desktop, ~120vh on mobile, sequence chosen by viewport **orientation** and re-resolved on rotation. Frames ease toward scroll progress on rAF rather than snapping. Assets and tuning live in `lib/hero/assets.ts`.
Three copy lines surface one at a time at fixed progress (0.10–0.30, 0.35–0.55, 0.60–0.80), Archivo 800 `clamp(2rem, 5vw, 4rem)`, tracking `-0.035em`, bone, left-aligned to the page margin, each fading in while rising 12px then dissolving. At 0.85–1.00 the headline + CTAs land **bottom left** as before (tiny label, short-line headline, two CTAs; right side empty). All copy lives in `content/en.ts`; "IN THE CASE." is one shared constant with the `/inventory` headline so the echo can never drift.
After the scrub completes, an optional looping video (first frame identical to the last scrub frame) takes over as the background; until those clips exist — or when autoplay is refused (iOS Low Power Mode) — the final frame holds.
The scrub's first frame is the same scope view the intro game resolves into, so the game's exit wipe reads as one continuous shot. Body scroll is locked while the game overlay is open and scroll resets to top when it closes, so the scrub always starts at frame 0.
Fallbacks, all deliberate: reduced motion or frame failure → final frame with the headline already visible (failures logged). The first frame is the LCP element, preloaded at priority; the full sequence stays under 2.5MB transferred.
Bottom right corner: the scroll-indicator rule, as before.

**B. Currently featured, ~85vh, split**
Screen split 60/40. Image of the featured item bleeds off the **right** edge, full height of the section. Left side holds: label `CURRENTLY FEATURED`, item name huge, one short paragraph, the live entry counter as a large number with a tiny label under it, a countdown, and the CTA.
The counter number uses the same 800 weight at ~72px. It should read as a scoreboard, not as body copy.

**C. Fresh arrivals, auto height, editorial index**
Not a grid. See section 3. Show the six newest items, then a text link `VIEW ALL INVENTORY →`.

**D. The shop, ~70vh, split reversed**
Image bleeds off the **left** edge this time. Right side holds the story copy, the address, and the hours as a two-column definition list. The alternation from section B is deliberate; the eye should zigzag down the page.

**E. Brands, ~30vh, type only**
`TARAN TACTICAL · RETRORIFLE · SAVIOR` set at 800 weight, ~40px, `--muted` at 40% opacity, on a single line, horizontally scrolling slowly on a marquee. No logos. Type only. This section is short on purpose, it is a breath between two heavy sections.

**F. Visit, ~80vh, split**
Map on one side, contact block on the other. The map is styled dark, not the default Google blue and white. Use a dark map style JSON or a static styled map image. A default Google Maps embed will undo everything else on this page.

**G. Footer**
Four columns on desktop, stacked on mobile: logo and mark, hours, navigation, legal. Compliance disclaimer in 11px `--muted` across the bottom, above a copyright line.

---

## 3. Inventory index — the signature layout

This is the page that makes people remember the site. Do not build a card grid.

**Desktop:**

Each item is a full-width row, roughly 96px tall:

```
01   NIGHTHAWK CUSTOM REVOLVER                    REVOLVER    AVAILABLE
     ─────────────────────────────────────────────────────────────────
02   TARAN TACTICAL GLOCK                          PISTOL     AVAILABLE
     ─────────────────────────────────────────────────────────────────
```

- Index number: 11px, 600, `--muted`, fixed 48px column
- Name: Archivo 800, 30px, `--bone`, tracking `-0.03em`, flex-grow
- Category: 11px, 0.28em tracking, uppercase, `--muted`, right aligned, fixed width
- Status chip: `--acid` for available, `--muted` for reserved, `--danger` for sold
- 0.5px hairline between rows

**On hover:** the item image appears as a floating panel roughly 340x420px that follows the cursor with easing (lerp factor around 0.12 so it lags behind slightly). The hovered row's name shifts right by 12px and brightens to full `--bone`, all other rows drop to 45% opacity. Cross-fade the image on 180ms when moving between rows.

**Filters:** a horizontal row of text labels above the list, not dropdowns, not chips with backgrounds. `ALL / PISTOL / REVOLVER / RIFLE / PCC / OPTICS`. The active one is `--acid` with a 1px underline. Filtering animates the rows out and in with a short stagger, roughly 25ms per row.

**Mobile:** the hover panel is impossible, so the layout changes rather than shrinking. Each row becomes a stacked block: image at 16:9 bleeding to both screen edges, then the number and name below it, then category and status on one line. Still separated by hairlines, still no cards, still no rounded corners.

---

## 4. Item detail page

**Desktop, a true split, no container max-width:**

Left half, 50vw, sticky, full viewport height: the image gallery. Main image fills the space, `object-cover`. Thumbnails as a vertical strip of small squares pinned to the bottom left of that panel. Clicking swaps with a 200ms cross-fade.

Right half, 50vw, scrolls: everything else, in this order.

1. Breadcrumb, 11px: `INVENTORY / PISTOL`
2. Item name, 800, ~44px
3. Status chip and brand on one line
4. Price display, 800, 24px, or `CALL FOR PRICE` in the same slot
5. Short description, 16px, `--muted`, max 60ch
6. **Video**, full width of the column, 16:9, poster frame with a play button overlay. Lazy loaded. This sits high, above the specs, because video is the selling tool on this site
7. Specs as a definition list: label left in 11px `--muted`, value right in 14px `--bone`, hairline between each row
8. CTA block, sticky to the bottom of the viewport once scrolled past: `INQUIRE ABOUT THIS` primary, `CALL` and `WHATSAPP` secondary
9. `MORE LIKE THIS`, three items in the same editorial row format from section 3

**Mobile:** gallery becomes a full-bleed swipeable carousel with dot indicators at the top, then everything else stacks in the same order. The CTA block becomes a fixed bottom bar with the primary action and a call icon.

---

## 5. Featured / entry program page

Structure it like a fight card, not a product page.

- **Top:** the prize, full bleed image, 70vh, with the item name in the bottom left and the entry counter bottom right at ~90px in 800 weight
- **Then:** a horizontal strip of three stats with hairlines between them: entries claimed, time remaining, entrants
- **Then:** how it works, three numbered steps in the editorial row format
- **Then:** the entry form. Full width, dark surface, generous. Fields are underline-only inputs, no boxes, 56px tall, label above in 11px tracked. Focus state is an `--acid` underline
- **Then:** the free entry method, in a bordered box so it is visually distinct and impossible to claim was hidden
- **Then:** past winners, small grid with photo, name and date
- **Rules** link at the bottom, always visible

---

## 6. Motion

Restrained. Everything is either fast or does not move.

- Page transitions: none. Hard cuts. This is a showroom, not a slideshow
- Section reveals: `opacity 0 → 1` and `translateY 16px → 0` over 500ms with `cubic-bezier(0.16, 1, 0.3, 1)`, triggered at 15% in view, once only
- Stagger inside a group: 60ms
- Hover on interactive elements: 180ms
- The cursor-following image panel is the only continuous animation on the site
- Everything above is disabled under `prefers-reduced-motion`

---

## 7. Header

Fixed, 72px tall, transparent over the hero, then it gains a `--ink` background at 92% opacity with backdrop blur after 80px of scroll.

Left: skull logo at 30px plus `MLF × SCO` wordmark.
Centre: nothing.
Right: nav labels at 11px with 0.28em tracking, and a `VISIT` CTA as a bordered rectangle.

Mobile: logo left, hamburger right. The menu opens as a full-screen `--ink` panel with the nav items at 800 weight and 36px, stacked left aligned with hairlines between them, plus hours and a call button at the bottom. Not a dropdown, not a slide-in drawer from the side.

---

## 8. Banned list

If any of these appear in the codebase, the design has drifted:

- `rounded-lg`, `rounded-xl`, `rounded-full` outside the status chip
- A radius above 2px on a control, or any radius at all on content
- `shadow-md`, `shadow-lg`, or **any non-inset `box-shadow`** — controls use
  inset edges only, and nothing on the site floats off the page
- A glow, a soft outer shadow, or a bevel wide enough to read as 3D
- `grid-cols-3` with cards for the inventory listing
- `max-w-7xl mx-auto` wrapping a whole page
- `text-center` on any section other than the intro game
- A gradient used as decoration rather than an image scrim or a control's
  edge pair
- Emoji anywhere in the UI
- A default Google Maps embed
- More than one `--acid` filled button in a single view, or `--acid` as a
  large background area
- `--amber` or `--danger` used for anything but their one meaning: caution
  and destruction. Never decorative
- A transparent bordered rectangle used as a button — that is the old
  system and the thing this replaced. Every interactive element is a
  `.control`, a `.cta-primary`, or a text link
- Any font that is not Archivo

---

## 9. Definition of done for the visual layer

Open the home page and the inventory page next to `Molon-Labe-Website-Proposal.pdf`. They should look like the same brand made them. Same type contrast, same hairlines, same restraint with colour, same bleeding images.

If the site looks lighter, softer or rounder than the PDF, it drifted.
