// ---------------------------------------------------------------------------
// Intro arcade — DEFAULT difficulty tuning. The owner can override round
// length, target count, pop duration, and magazine size per mode from the
// admin (Game & Offer); values here are the fallback when no settings row
// exists. Desktop and mobile are tuned separately: tapping is slower than
// aiming.
// ---------------------------------------------------------------------------

export const READY_MS = 900; // "READY" card
export const GO_MS = 500; // "GO" card
export const RELOAD_MS = 700; // reload downtime
export const RISE_MS = 130; // alien pop-up / duck animation

// The one transition in the ending: the shop interior cross-fades into the
// hero scrub's frame 0 (the scope view) when the round resolves. Everything
// after that — result card, continue, scrolling — happens over that same
// unchanging image, so the whole ending reads as one continuous shot.
export const CROSSFADE_MS = 300;

export const DESKTOP_TUNING = {
  roundMs: 10_000, // round length
  targetCount: 8, // hits needed to win
  popMinMs: 500, // alien stays up between these...
  popMaxMs: 900, // ...before ducking
  spawnStartMs: 850, // spawn interval at round start
  spawnEndMs: 420, // spawn interval at round end (accelerates)
  maxUp: 3, // max aliens up at once
  hitboxGrow: 1.0,
  magSize: 6, // shots per magazine
};

export const MOBILE_TUNING = {
  roundMs: 10_000,
  targetCount: 6,
  popMinMs: 750,
  popMaxMs: 1150,
  spawnStartMs: 900,
  spawnEndMs: 480,
  maxUp: 3,
  hitboxGrow: 1.45, // thumbs are blunt instruments
  magSize: 6,
};

export type Tuning = typeof DESKTOP_TUNING;
