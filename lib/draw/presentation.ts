// Shared shapes and timings for the draw presentation, plus the fake
// pool that rehearsal mode runs on.
//
// Everything the presentation screen receives is already redacted. There
// is no email, no phone number and no surname in any type in this file,
// because the screen it feeds is going to be broadcast.

export type PoolMember = {
  /** Opaque. Only used to key the tiles and to match the winner. */
  id: string;
  /** First name plus last initial. Never anything else. */
  name: string;
  /** Tickets held. Drives how many times the name appears in the pool. */
  weight: number;
};

/** What `commitDraw` hands back once the result exists in the database. */
export type DrawRecord =
  | { ok: false; error: string }
  | {
      ok: true;
      /** True when the campaign already had a winner and this is a re-run. */
      replay: boolean;
      name: string;
      ticket: number;
      total: number;
      seed: string;
      drawnAt: string;
    };

/** The result the stage animates toward, from a live draw or a rehearsal. */
export type Reveal = {
  name: string;
  ticket: number;
  total: number;
  seed: string;
  drawnAt: string;
};

export type Orientation = "vertical" | "horizontal";

// Timings. Collected here because the sequence is a piece of choreography
// and reading it in one place is the only way to judge the pacing.
export const POOL_FILL_MS = 1800;
export const POOL_HOLD_MS = 1000;
export const SPIN_MS = 8000;

/**
 * Name changes across the spin. With the cubic ease-out below this opens
 * at roughly 37 changes a second — fast enough to read as a blur — and
 * puts the last three changes at about 5.8s, 6.3s and 8.0s. That widening
 * final gap is the whole effect; the number is tuned for it, not picked
 * for roundness.
 */
export const SPIN_TICKS = 100;

/** 1 - (1-t)^3. Front-loaded, with a long tail where the tension lives. */
export function spinEase(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/**
 * Ceiling on rendered pool tiles. A pot of 4,000 entries cannot be 4,000
 * DOM nodes on a phone and still hold 60fps, so past this the pool is
 * sampled proportionally — a ten-entry entrant is still ten times as
 * likely to appear in the sample as a one-entry entrant, so the thing the
 * moment is meant to communicate survives the truncation.
 */
export const MAX_TILES = 280;

/** Names cycled during the spin. More than this and the reel is padding. */
export const MAX_REEL = 120;

const REHEARSAL_FIRST = [
  "Marcus", "Elena", "Dante", "Priya", "Cole", "Rosa", "Aaron", "Nadia",
  "Victor", "Simone", "Owen", "Lucia", "Grant", "Talia", "Mateo", "Bree",
  "Hugo", "Isela", "Reid", "Camila", "Silas", "Noor", "Beau", "Ximena",
  "Kai", "Delia", "Ronan", "Paloma", "Emmett", "Yara", "Cash", "Renata",
];

const REHEARSAL_LAST = "ABCDEFGHIJKLMNOPRSTVWZ";

/**
 * A believable pool with no database behind it. Deterministic so a
 * rehearsal looks the same every time and the owner can practise against
 * a stable picture, and weighted unevenly so the pool step actually
 * demonstrates what weighting looks like.
 */
export function rehearsalPool(count = 64): PoolMember[] {
  const members: PoolMember[] = [];
  for (let i = 0; i < count; i++) {
    const first = REHEARSAL_FIRST[i % REHEARSAL_FIRST.length];
    const initial = REHEARSAL_LAST[(i * 7) % REHEARSAL_LAST.length];
    // A long tail of single entries with a handful of heavy holders, which
    // is what a real pot looks like.
    const weight = i % 11 === 0 ? 10 : i % 5 === 0 ? 4 : i % 3 === 0 ? 2 : 1;
    members.push({ id: `rehearsal-${i}`, name: `${first} ${initial}.`, weight });
  }
  return members;
}
