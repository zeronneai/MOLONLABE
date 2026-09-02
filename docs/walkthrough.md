# Building the walkthrough PDF

`docs/site-walkthrough.pdf` is a nine-page client document: a cover and
one page per section, each with a screenshot and a caption written for the
shop owner rather than for a developer.

It is generated, not hand-made, so it can be reshot in a couple of minutes
whenever the site changes.

## The two commands

```bash
# 1. Shoot the frames from the DEPLOYED preview
BASE_URL=https://your-preview.vercel.app \
ADMIN_EMAIL=owner@example.com \
ADMIN_PASSWORD=... \
npm run walkthrough:capture

# 2. Lay them out and print the PDF
npm run walkthrough:build
```

Needs Playwright's Chromium: `npx playwright install chromium`.

Point it at the deployed preview, never a local dev server. The entire
value of this document is that the photographs and the stock in it are the
client's real ones — the product images come from Cloudinary and the
inventory comes from the live database, and neither exists on a laptop
running against an empty local setup.

## What the capture does

| Section | How it is staged |
| --- | --- |
| 01 Intro game | Fresh browser so the game actually runs, two seconds into the round, cursor on the field and shots fired so the frame has a hit in it |
| 02 Age gate | Intro marked as seen, age answer cleared — the one moment the gate stands alone |
| 03 Hero | Three scroll positions across the scrub, so the pull-back reads as a sequence |
| 04 Inventory | A row hovered so the image panel on the right is showing something |
| 05 Item page | Top, then scrolled, to show the gallery staying put |
| 06 Featured | Top, then the entry form scrolled into view |
| 07 Admin | 390px wide, in a phone-shaped frame, because that is how it will be used |
| 08 Draw | **Rehearsal mode only.** Pool, spin and lock. Shooting a live draw would commit a real winner just to make a picture |

Admin credentials are optional. Without them sections 7 and 8 are skipped
and their panels render as pending rather than being invented.

`DRAW_CAMPAIGN_ID` can be set to pick a specific campaign; otherwise the
first one in the admin is used.

## Missing frames

Any frame that was not captured renders as a marked pending panel, and the
cover carries a "layout proof — not for the client" block listing how many
are outstanding. That is deliberate: a walkthrough with invented pictures
in it is worse than one with visible holes, because the holes are the only
thing that stops it being sent out by mistake.

Once every frame is captured, the proof block disappears on its own.

## Editing it

Captions and section order live in `scripts/walkthrough/shots.mjs`, in one
list. Change a caption there, rerun the build, and nothing else needs
touching — the capture and the layout both read the same list, so the
document cannot drift from what was shot.

The layout follows DESIGN.md: Archivo 800 at tight negative tracking for
headlines, tiny letterspaced uppercase labels, hairlines instead of
shadows, square corners, ink and bone with acid used once per page at
most. Copy hangs off a left rule and the screenshots escape it to the
right edge, which is the same composition rule the site itself uses.

Archivo is embedded into the document from the copy the app build already
fetched, so the PDF renders identically with no network.
