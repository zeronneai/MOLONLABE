# Testing the draw presentation on a phone

The sandbox this was built in is not a phone, so the frame rate had to be
measured under CPU throttling rather than on the real device. This is what
was measured, what to look for on the actual hardware, and what counts as
a problem rather than expected.

## What was measured

Chromium, 9:16 at 450×800 CSS with a 2× pixel ratio, frame deltas sampled
from `requestAnimationFrame` through the whole sequence, three runs per
cell, under CDP CPU throttling. "Long frame" means a gap over 16.7ms — a
frame that missed 60fps.

Throttling is a rough stand-in for device class: **1× ≈ a desktop or a
current flagship phone, 4× ≈ a mid-range Android, 6× ≈ an older or
budget phone**. It models CPU only, not GPU or thermal state.

Long frames, as shipped (tile cap 160):

| CPU | Entrants | Tiles | Pool fill | Spin | Lock |
| --- | --- | --- | --- | --- | --- |
| 1× | 24 | 69 | 0% | 0% | 0% |
| 1× | 64 | 160 | 2% | 0% | 1% |
| 1× | 400 | 160 | 1% | 0% | 1% |
| 4× | 24 | 69 | 2% | 0% | 2% |
| 4× | 64 | 160 | 2% | 2% | 3% |
| 4× | 400 | 160 | 2% | 1% | 3% |
| 6× | 24 | 69 | 2% | 0% | 3% |
| 6× | 64 | 160 | 3% | 8% | 6% |
| 6× | 400 | 160 | 3% | 6% | 6% |

## What to look for, in order

1. **The first four seconds of the spin.** This is the only part of the
   sequence with a real frame budget problem, and it is where any
   stutter will show. Watch the pool of names behind the cycling name,
   not the cycling name itself — tearing or a visible hitch in the
   background block is the symptom.
2. **The pool filling in.** 160 names animate in over 1.8s. A stagger
   that arrives in visible clumps rather than a smooth sweep means the
   device is behind.
3. **The moment of the lock.** The pool drops to near black over 600ms
   while the winner scales up. A jump straight from one state to the
   other, with no fade, is a dropped transition.
4. **Everything after the lock is static** and should be perfectly still.
   Any movement there is a bug, not a performance limit.

## What is expected and what is a problem

- **Expected:** an occasional hitch in the first half of the spin on an
  older phone. At 6× that was 6–8% of frames — noticeable if you look for
  it, invisible at normal viewing.
- **Expected:** the sequence takes the same wall-clock time regardless.
  The choreography is driven by timestamps, not frame counts, so a slow
  device drops frames rather than running the spin long. The lock still
  lands at 8.0s.
- **A problem:** visible stutter through the whole spin, the deceleration
  looking stepped rather than smooth, or the pool taking more than about
  two seconds to fill. That is well outside anything measured.
- **A problem:** the winner appearing before the spin finishes, or the
  name changing after the lock. That would be a logic bug, not
  performance.

## If it is worse than this on his phone

The single lever is `MAX_TILES` in `lib/draw/presentation.ts`. Tile count
is what costs — with the pool hidden entirely the spin holds 60fps at 6×
with essentially no long frames, and the cap moving from 280 to 160 took
the 4× spin from about 16% long frames to 1–2%.

Lowering it further is close to free visually, because `tileScale` in
`DrawStage` grows the type to compensate: 120 large names fill the frame
as well as 160 smaller ones. What is given up is sampling granularity on
a large pot, and the screen already states the real total rather than
implying the sample is everything.

Things that were tried and did **not** help, so they are not worth
retrying: reducing or removing the motion blur on the cycling name
(identical timings), promoting the pool to its own compositor layer, and
`contain` on the pool or the reveal. The cost is the number of text nodes
being repainted, not the filter and not layer count.

## Pool size is not the variable people expect

Tiles are capped, so a 400-entry pot and a 4,000-entry pot render exactly
the same 160 nodes and cost the same. Above roughly 140 weighted entries
the frame rate stops depending on pot size altogether. What does keep
growing with a very large pot is the entrant list sent to the page —
around 50 bytes per entrant — which affects how long the screen takes to
load, not how smoothly it animates.
