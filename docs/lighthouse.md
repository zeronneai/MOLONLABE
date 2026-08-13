# Running Lighthouse against the preview

I cannot run this from the build sandbox: Cloudinary is blocked here, so
every image and every hero frame fails to load and any score I produced
would be fiction. This has to be run against the deployed preview. Here
is exactly how, and what to expect.

## How to run it

**Do this first, or the numbers are meaningless:**

1. Open the preview in a **fresh incognito window**. Extensions inflate
   scripting time and tank performance scores.
2. Load the page once and let it settle, then **clear `localStorage`**
   (DevTools → Application → Local Storage → right-click → Clear). The
   intro game and the age gate both persist there. A run where the game
   is skipped measures a different page than a real first visit.
3. Decide which visit you are measuring — see "Which visit" below.

Then: DevTools → **Lighthouse** panel → Mode **Navigation**, Device
**Mobile**, all four categories → **Analyze page load**.

Run it **three times and take the median**. Single Lighthouse runs vary
by 5–10 points on performance for reasons that have nothing to do with
the site.

CLI alternative, if you'd rather have a file:

```
npx lighthouse https://<preview-url> \
  --preset=desktop \
  --output=html --output-path=./lh-desktop.html
npx lighthouse https://<preview-url> \
  --output=html --output-path=./lh-mobile.html
```

## Which visit to measure

The brief's target — performance 90+, accessibility 95+, SEO 100 on home
— is only meaningful for the **returning** visit, and you should measure
both:

- **Returning visit** (localStorage populated, no game, no age gate).
  This is what most traffic sees and what the target applies to.
- **First visit** (cleared localStorage). The intro game preloads two
  backgrounds, three alien sprites and a pistol before it starts. It will
  score worse. That is the cost of the feature, not a defect.

## What I expect to pass

- **SEO 100** on every public route. Metadata, canonicals, robots,
  sitemap and structured data are all in place.
- **Accessibility 95+**. Tap targets are 44px throughout, the controls
  carry `aria-pressed`, forms have real labels, dialogs are labelled and
  focus-trapped.
- **Best practices** high, with the caveat below about console noise.

## What I expect to fail, and why it may not be a defect

**1. LCP on the home page — the most likely miss.**
The hero is a ~100-frame scrubbed sequence. The LCP element is the first
frame, preloaded with `priority`, but the sequence behind it competes for
bandwidth. Watch:
- If **LCP > 2.5s but the first frame renders fast**, the problem is
  contention, not the image. Fix by lowering `FRAME_COUNT` in
  `lib/hero/assets.ts` (100 → 60 is barely visible in motion) or dropping
  the width (1600 → 1280).
- Lighthouse will likely flag **"Enormous network payloads"** on home.
  Expected: the frame sequence is the payload. Check it against the 2.5MB
  target we set — the number to look at is the *total* of the
  `res.cloudinary.com` webp requests in the Network tab.

**2. "Serve images in next-gen formats" / "Properly size images".**
Should not fire — everything goes through Cloudinary `f_auto,q_auto` and
`next/image`. If it does fire, tell me which URL: it means something is
bypassing the loader.

**3. "Avoid enormous network payloads" on first visit.**
Expected. The game preloads its art up front by design, with a stated
<700KB budget. Worth verifying that budget on the real files — I never
could.

**4. Console errors under Best Practices.**
Two are ours and are informational, not faults:
- `[hero] could not measure <id>` — only if Cloudinary's `fl_getinfo`
  endpoint is unreachable; the scrub falls back to the configured
  duration.
- `[handoff] …` debug lines — `console.debug`, hidden unless Verbose is
  on. They should not affect the score.
Anything else in the console is worth sending to me.

**5. CLS from the intro overlay.**
Should be zero — the overlay is `position: fixed` and the page renders
underneath it. If CLS is non-zero on first visit, that is a real bug;
send me the number and the element Lighthouse names.

## What to send me

If something fails, the useful things are: the score for each of the four
categories, whether it was the first or returning visit, the LCP value
and which element Lighthouse names as the LCP, and the total transfer
size. From those I can tell a real regression from the expected cost of
the hero and the game.
