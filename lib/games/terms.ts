// The terms of buying a spot.
//
// These deliberately do NOT live in lib/legal.ts. That file is frozen
// until the attorney returns the sweepstakes wording, and dropping new
// legal-adjacent copy into it now would mean editing it twice and mixing
// my words with his in the same diff. Merge this in when that lands.
//
// Mine, not the attorney's. Three facts the buyer has to have seen before
// paying, and nothing else: there is no end date, the game ends when it
// sells out, and the money does not come back.

export const GAME_TERMS = [
  "This game runs until all spots are sold. There is no end date and no countdown.",
  "All spot purchases are final. No refunds, no exchanges, no transfers.",
  "The winner is drawn once the last spot sells.",
] as const;

/**
 * The single sentence stored on the order beside its acceptance
 * timestamp. A timestamp without the words it refers to proves only that
 * somebody clicked something, so the two are always written together.
 */
export const GAME_TERMS_TEXT = GAME_TERMS.join(" ");

/**
 * Bumped whenever GAME_TERMS changes, so a stack of orders can be grouped
 * by which wording was in force without diffing strings.
 */
export const GAME_TERMS_VERSION = "2026-09-agency-1";

/** The checkbox label. Says what is being agreed to, not "I agree". */
export const GAME_TERMS_CONSENT =
  "I understand this game runs until all spots sell, that there is no end date, and that my purchase is final.";

/** The opt-in that puts a first name on the public board. */
export const SHOW_NAME_LABEL = "Show my first name on the spot board";

export const SHOW_NAME_HELP =
  "Off by default. Tick this and your spots show your first name and last initial — nothing else, and never your email or phone. Leave it and they stay anonymous.";
