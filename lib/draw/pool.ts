// Turning the entrant list into the tiles the pool step renders.
//
// Nothing here touches the outcome. The winner arrives as a finished
// record; this file only decides which names are drawn on screen and in
// what order. It deliberately uses Math.random rather than the seeded
// generator in select.ts — the two must never share a source, so that no
// future edit can accidentally make a cosmetic shuffle move the result.

import { MAX_TILES, type PoolMember } from "./presentation";

export type Tile = { key: string; name: string };

export type PoolView = {
  tiles: Tile[];
  /** Weighted entries the tiles stand for. */
  total: number;
  /** Entries the sample could not show. Zero when everything is rendered. */
  hidden: number;
};

/** Fisher-Yates. Cosmetic only — see the note at the top of the file. */
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Expands the pool by weight, so a ten-entry entrant occupies ten tiles.
 *
 * Past MAX_TILES the expansion is sampled at a fixed stride instead of
 * truncated. Systematic sampling keeps the proportions: an entrant with
 * ten of a thousand tickets still gets ten times the tiles of a
 * single-entry entrant, so the point the step is making — more entries
 * means more of the screen is you — survives the cap. `hidden` carries
 * the remainder so the screen can state the real number rather than
 * implying the sample is the whole pot.
 */
export function buildPool(members: PoolMember[]): PoolView {
  const weights = members.map((m) => Math.max(1, Math.floor(m.weight)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return { tiles: [], total: 0, hidden: 0 };

  // Cumulative bounds, so a virtual ticket index maps to an owner without
  // ever materialising the expanded array.
  const bounds: number[] = [];
  let running = 0;
  for (const w of weights) {
    running += w;
    bounds.push(running);
  }

  const ownerOf = (ticket: number): number => {
    let lo = 0;
    let hi = bounds.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ticket < bounds[mid]) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };

  const count = Math.min(total, MAX_TILES);
  const stride = total / count;
  const tiles: Tile[] = [];
  for (let i = 0; i < count; i++) {
    const ticket = Math.min(total - 1, Math.floor(i * stride));
    const member = members[ownerOf(ticket)];
    tiles.push({ key: `${member.id}-${i}`, name: member.name });
  }

  return { tiles: shuffle(tiles), total, hidden: total - count };
}

/**
 * The names cycled during the spin. Distinct people rather than tickets:
 * a reel that repeats one heavy entrant twenty times in a row reads as a
 * bug, not as weighting, and the reel is not what decides anything.
 */
export function buildReel(members: PoolMember[], max: number): string[] {
  const names = shuffle(members.map((m) => m.name));
  return names.slice(0, Math.max(1, Math.min(max, names.length)));
}
