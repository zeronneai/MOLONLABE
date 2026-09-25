// Shared shapes and timings for the draw presentation, plus the fake
// pool that rehearsal mode runs on.
//
// Everything the presentation screen receives is already redacted. There
// is no email, no phone number and no surname in any type in this file,
// because the screen it feeds is going to be broadcast.

import type { RosterEntry } from "./roster";

/** A fake buyer for rehearsal. `weight` is how many guides they hold. */
export type PoolMember = {
  id: string;
  /** First name plus last initial. Never anything else. */
  name: string;
  weight: number;
};

/** What `commitDraw` hands back once the result exists in the database. */
export type DrawRecord =
  | {
      ok: false;
      error: string;
      /**
       * Set when the refusal is "there are unsold spots, are you sure".
       * That is not a failure — it is a question, and the caller has to
       * tell the two apart to know whether to offer a way through.
       */
      needsEarlyConfirmation?: boolean;
      unsold?: number;
      totalSpots?: number;
    }
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
  /** Whose wedge the wheel stops on. */
  winnerKey: string;
  /** How far the wheel turns, in degrees, to stop there. */
  rotation: number;
};

export type Orientation = "vertical" | "horizontal";

// Timings. Collected here because the sequence is a piece of choreography
// and reading it in one place is the only way to judge the pacing.

/**
 * How long each roster page stays up before turning by itself. Long
 * enough to read a page of names on a phone watching the reel, or to
 * pause the video on it.
 */
export const ROSTER_PAGE_MS = 4500;

/**
 * The least time a page must be on screen to count as shown. The owner
 * can step through faster than the automatic turn with the arrow keys,
 * but not so fast a page never makes it into a frame worth reading.
 */
export const ROSTER_MIN_MS = 1500;

/**
 * Buyers per roster page, as columns x rows, measured against each frame
 * so that a full page fits with nothing clipped. tests/browser/drawroster.mjs
 * checks every row of every page sits inside the frame.
 */
export const ROSTER_LAYOUT = {
  vertical: { cols: 2, rows: 24 },
  horizontal: { cols: 3, rows: 10 },
} as const;

/**
 * Up to this many buyers, the roster is one column in large type: a small
 * drop shown as two lines of body copy in an empty frame reads as though
 * something failed to load.
 */
export const ROSTER_LARGE_MAX = 12;

/** The wheel's spin, start to stop. */
export const SPIN_MS = 8000;

/** Whole turns before the wheel settles. */
export const WHEEL_TURNS = 6;

/**
 * How long the post-reveal controls stay up once summoned. Long enough to
 * reach for a button, short enough that a stray tap does not leave them
 * sitting in the shot.
 */
export const CONTROLS_HIDE_MS = 3800;

/**
 * 1 - (1-t)^4. A wheel that is spun hard and coasts: most of the turning
 * happens early, and the last quarter-turn takes seconds, which is where
 * everybody watching leans in.
 */
export function wheelEase(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv * inv;
}

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

/**
 * The rehearsal pool as a roster: each fake buyer holds `weight` guides,
 * numbered in order, so a practice run looks and behaves like a real one.
 */
export function rehearsalRoster(count = 64): RosterEntry[] {
  let next = 1;
  return rehearsalPool(count)
    .map((m) => {
      const numbers = Array.from({ length: Math.max(1, m.weight) }, () => next++);
      return { key: m.id, name: m.name, count: numbers.length, numbers };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
