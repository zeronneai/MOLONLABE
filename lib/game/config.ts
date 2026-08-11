// ---------------------------------------------------------------------------
// Intro arcade — difficulty tuning lives HERE and nowhere else.
// Desktop and mobile are tuned separately: tapping is slower than aiming.
// ---------------------------------------------------------------------------

export const ROUND_MS = 10_000; // round length
export const READY_MS = 900; // "READY" card
export const GO_MS = 500; // "GO" card

export const DESKTOP_TUNING = {
  targetCount: 8, // hits needed to win
  popMinMs: 500, // alien stays up between these...
  popMaxMs: 900, // ...before ducking
  spawnStartMs: 850, // spawn interval at round start
  spawnEndMs: 420, // spawn interval at round end (accelerates)
  maxUp: 3, // max aliens up at once
  hitboxGrow: 1.0,
};

export const MOBILE_TUNING = {
  targetCount: 6,
  popMinMs: 750,
  popMaxMs: 1150,
  spawnStartMs: 900,
  spawnEndMs: 480,
  maxUp: 3,
  hitboxGrow: 1.45, // thumbs are blunt instruments
};

export const MAG_SIZE = 6; // shots per magazine
export const RELOAD_MS = 700; // reload downtime
export const RISE_MS = 130; // alien pop-up / duck animation

export type Tuning = typeof DESKTOP_TUNING;

// Placeholder until the settings table + admin control land (next step).
// `enabled: false` must cleanly remove the discount from the win screen.
export const DISCOUNT_PLACEHOLDER = {
  enabled: true,
  code: "MOLON10",
  value: "10% OFF ONE ACCESSORY",
  expires: "In store, this month",
};

export type DiscountConfig = typeof DISCOUNT_PLACEHOLDER;
