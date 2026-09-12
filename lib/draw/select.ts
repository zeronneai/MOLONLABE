// The draw itself. Pure, deterministic, and deliberately free of any
// dependency on React, the database, or the animation that presents it.
//
// The whole point of this file is auditability. Given the seed and the
// entrant list, `selectWinner` returns the same winner on any machine, in
// any order the rows happened to arrive from Postgres, forever. The
// presentation layer never calls anything in here to decide anything — it
// receives a finished result and animates toward it. See
// docs/draw-verification.md for the procedure a third party would follow.

export type PoolEntrant = {
  id: string;
  /** entry_count from the database. Coerced to a whole ticket count >= 1. */
  weight: number;
};

export type DrawResult = {
  entrantId: string;
  /** 1-based ticket that won, for display. `ticket` of `total`. */
  ticket: number;
  /** Every entry in the pot, weighted. */
  total: number;
  seed: string;
};

/**
 * A ticket count can only ever be a positive whole number. A null, a zero
 * or a fractional entry_count would silently distort the odds, so it is
 * normalised here rather than at each call site.
 */
export function ticketsFor(entryCount: number | null | undefined): number {
  return Math.max(1, Math.floor(entryCount ?? 1));
}

/** xmur3 — spreads a string seed across 32 bits before it reaches the PRNG. */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — small, fast, and identical across engines. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sorting by id before walking the pool is the part that makes this
 * auditable. Postgres makes no promise about row order without an ORDER
 * BY, so without a stable sort the same seed could pick a different
 * person on a re-run and the seed would prove nothing.
 */
function stableOrder(entrants: PoolEntrant[]): PoolEntrant[] {
  return [...entrants].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Picks one ticket from the pot. Someone holding ten spots owns ten of
 * the numbers, which is the whole model: a spot is a spot, and the only
 * way to hold one is to buy it.
 */
export function selectWinner(
  entrants: PoolEntrant[],
  seed: string,
): DrawResult | null {
  const pool = stableOrder(entrants);
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, e) => sum + ticketsFor(e.weight), 0);
  if (total === 0) return null;

  const rand = mulberry32(hashSeed(seed));
  // Clamped because a PRNG returning exactly 1 would index off the end.
  // mulberry32 never does; the clamp is here so a future swap can't
  // introduce an off-by-one that only shows up once in four billion draws.
  const ticket = Math.min(total - 1, Math.floor(rand() * total));

  let cursor = ticket;
  for (const entrant of pool) {
    cursor -= ticketsFor(entrant.weight);
    if (cursor < 0) {
      return { entrantId: entrant.id, ticket: ticket + 1, total, seed };
    }
  }
  // Unreachable while total is the sum of the same weights walked above.
  const last = pool[pool.length - 1];
  return { entrantId: last.id, ticket: total, total, seed };
}

/** One spot as it was recorded in the frozen pool on the winners row. */
export type PoolSpot = { spot_id: string; spot_number: number };

export type DrawAudit = {
  seed: string;
  /** The spots the draw ran against, exactly as recorded. */
  pool: PoolSpot[];
  /** 1-based index the selector returned. */
  ticketIndex: number;
  /** The winning SPOT NUMBER — what was announced. */
  ticket: number;
  /** Spots in the pool at the moment of the draw. */
  total: number;
};

export type Verification =
  | { ok: true; spotNumber: number; spotId: string }
  | { ok: false; reason: string };

/**
 * Re-runs a recorded draw and checks it produces the same winner.
 *
 * This is the property the whole seeded selector exists for, and it is a
 * function rather than a paragraph in a document so it can be asserted in
 * a test and run by anybody. It takes only what is stored on the winners
 * row — nothing is read back from game_spots — so a verification cannot
 * be quietly influenced by data that changed after the draw.
 *
 * The distinction that matters: `ticketIndex` is the selector's own
 * output, an index into a pool sorted by spot id. `ticket` is the spot
 * number that was announced. They are different numbers, and checking
 * both is what catches a mapping mistake between the two.
 */
export function verifyDraw(audit: DrawAudit): Verification {
  if (!audit.seed) return { ok: false, reason: "No seed was recorded." };
  if (!Array.isArray(audit.pool) || audit.pool.length === 0)
    return { ok: false, reason: "No pool was recorded." };
  if (audit.pool.length !== audit.total)
    return {
      ok: false,
      reason: `The recorded pool holds ${audit.pool.length} spots but the recorded total is ${audit.total}.`,
    };

  const replay = selectWinner(
    audit.pool.map((s) => ({ id: s.spot_id, weight: 1 })),
    audit.seed,
  );
  if (!replay) return { ok: false, reason: "The pool re-ran to nothing." };

  if (replay.ticket !== audit.ticketIndex)
    return {
      ok: false,
      reason: `Re-running the seed picked index ${replay.ticket}, but ${audit.ticketIndex} was recorded.`,
    };

  const winner = audit.pool.find((s) => s.spot_id === replay.entrantId);
  if (!winner)
    return {
      ok: false,
      reason: "The re-run picked a spot that is not in the recorded pool.",
    };

  if (winner.spot_number !== audit.ticket)
    return {
      ok: false,
      reason: `Re-running the seed picked spot ${winner.spot_number}, but spot ${audit.ticket} was announced.`,
    };

  return { ok: true, spotNumber: winner.spot_number, spotId: winner.spot_id };
}

/**
 * 16 hex characters — short enough to read aloud on camera and to fit on
 * one line under the winner, wide enough that nobody can claim it was
 * chosen to produce a particular outcome.
 */
export function newSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * First name plus last initial. This is the only form a winner's name
 * takes once it leaves the entrants table — on the presentation screen,
 * in the winners row, and on the public featured page. Applied at write
 * time, not at render time, so a future component cannot leak a surname
 * by rendering the wrong column.
 */
export function redactName(first: string, last: string): string {
  const given = first.trim();
  const family = last.trim();
  if (!family) return given;
  return `${given} ${family[0].toUpperCase()}.`;
}
