// The roster and the wheel: who is in the drawing, and how much of the
// wheel each of them holds.
//
// The rule the client published (rules clause 15): "Before the wheel is
// spun, every entry is shown on screen so viewers can confirm all buyers
// were included." The video is the proof, so the roster is built from the
// same rows the draw uses, shows every buyer, and has to add up to the
// number of guides sold. Nothing here samples, caps or truncates.
//
// Privacy: names leave this module as first name plus last initial, and
// only for a buyer who agreed at checkout that their name would appear on
// the broadcast (BROADCAST_NOTICE in lib/games/terms.ts). A buyer who has
// not, which includes everyone who paid before that notice existed, is
// still on the roster and still on the wheel, because the rule says every
// entry is shown; they appear by guide number instead of by name. The
// email address is used only to group one buyer's guides together and is
// never part of what is returned.

import { redactName } from "./select";

/** One buyer on the roster and one segment of the wheel. */
export type RosterEntry = {
  /** Opaque. Never derived from an email or a name. */
  key: string;
  /**
   * First name and last initial, or "Holder of guide #N" for a buyer who
   * has not agreed to be named on the broadcast. Nothing else.
   */
  name: string;
  /** False when the buyer has not agreed to be named on the broadcast. */
  named: boolean;
  /** Guides held, which is entries held. */
  count: number;
  /** The guide numbers they hold, ascending. Matches the winning number. */
  numbers: number[];
};

type SoldSpot = {
  spot_number: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  /** Whether this guide's order carries the broadcast acknowledgement. */
  broadcast_consent: boolean;
};

/** How a buyer who has not agreed to be named appears. */
export const unnamedLabel = (firstGuide: number) => `Holder of guide #${firstGuide}`;

/**
 * Every buyer, once, with their guides counted.
 *
 * Grouped by email address, because that is what one checkout records
 * for one person; a buyer who bought in three orders is one line with
 * the three orders' guides added up. Sorted by name so a viewer can find
 * themselves.
 */
export function buildRoster(spots: SoldSpot[]): RosterEntry[] {
  const groups = new Map<
    string,
    { first: string; last: string; numbers: number[]; consent: boolean }
  >();
  for (const s of spots) {
    const email = (s.email ?? "").trim().toLowerCase();
    const first = (s.first_name ?? "").trim();
    const last = (s.last_name ?? "").trim();
    const id = email || (first || last ? `name:${first.toLowerCase()} ${last.toLowerCase()}` : `guide:${s.spot_number}`);
    const g = groups.get(id) ?? { first, last, numbers: [], consent: false };
    g.numbers.push(s.spot_number);
    // One line per person, so one name or none. A buyer who agreed on any
    // of their orders has agreed to their name being shown; it is the
    // same name either way.
    g.consent = g.consent || s.broadcast_consent === true;
    groups.set(id, g);
  }
  const entries = [...groups.values()].map((g) => {
    const numbers = [...g.numbers].sort((a, b) => a - b);
    return {
      name: g.consent ? redactName(g.first || "Buyer", g.last) : unnamedLabel(numbers[0]),
      named: g.consent,
      count: numbers.length,
      numbers,
    };
  });
  // Named buyers alphabetically, so a viewer can find themselves; then
  // the unnamed ones by guide number, which is how they know themselves.
  entries.sort((a, b) =>
    a.named !== b.named
      ? a.named ? -1 : 1
      : a.named
        ? a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.numbers[0] - b.numbers[0]
        : a.numbers[0] - b.numbers[0],
  );
  return entries.map((e, i) => ({ key: `p${i + 1}`, ...e }));
}

/** Total entries on a roster. Must equal guides sold. */
export const rosterTotal = (roster: RosterEntry[]) =>
  roster.reduce((sum, r) => sum + r.count, 0);

/** Split into pages of `perPage`. Every entry lands on exactly one page. */
export function paginate<T>(items: T[], perPage: number): T[][] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length ? pages : [[]];
}

// ------------------------------------------------------------ the wheel

/** A wedge, in degrees clockwise from the top of the wheel. */
export type WheelSegment = {
  key: string;
  /** What the readout says: the roster's name for this buyer. */
  name: string;
  /**
   * What is printed on the wedge, which has room for a first name and an
   * initial and not much more. A buyer shown by guide number is "#12"
   * there, because "Holder of guide #12" cut to fit says nothing.
   */
  label: string;
  start: number;
  end: number;
};

/**
 * One wedge per buyer, its angle proportional to the guides they hold.
 * That proportion is the weighting the rule describes: a buyer with five
 * guides has five times the wheel, and five times the chance, of a buyer
 * with one.
 */
export function wheelSegments(roster: RosterEntry[]): WheelSegment[] {
  const total = rosterTotal(roster);
  let at = 0;
  return roster.map((r) => {
    const start = at;
    at += (r.count / total) * 360;
    return {
      key: r.key,
      name: r.name,
      label: r.named === false ? `#${r.numbers[0]}` : r.name,
      start,
      end: at,
    };
  });
}

/** A number in [0, 1) from a string, so a replay lands where the take did. */
function fraction(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * How far to turn the wheel so the pointer, at the top, ends inside the
 * winner's wedge. Several whole turns first, for the spin itself.
 *
 * The landing point inside the wedge comes from the seed rather than
 * Math.random, so replaying a recorded draw shows exactly the same stop.
 * It is kept away from the wedge's edges so nobody watching can argue the
 * pointer sat on a line.
 */
export function landingRotation(
  segments: WheelSegment[],
  winnerKey: string,
  seed: string,
  turns = 6,
): number {
  const seg = segments.find((s) => s.key === winnerKey);
  if (!seg) throw new Error("The winner is not on the wheel.");
  const inside = 0.2 + 0.6 * fraction(seed);
  const target = seg.start + (seg.end - seg.start) * inside;
  return turns * 360 + (360 - target);
}

/** Whose wedge is under the pointer at a given rotation. */
export function segmentAtRotation(segments: WheelSegment[], rotation: number): WheelSegment | null {
  const at = (((360 - (rotation % 360)) % 360) + 360) % 360;
  return segments.find((s) => at >= s.start && at < s.end) ?? segments[segments.length - 1] ?? null;
}

/** The roster entry holding a guide number. */
export function holderOf(roster: RosterEntry[], guideNumber: number): RosterEntry | null {
  return roster.find((r) => r.numbers.includes(guideNumber)) ?? null;
}
