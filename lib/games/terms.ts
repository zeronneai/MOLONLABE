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
//
// The third line used to stop at "The winner is drawn once the last spot
// sells." That was a promise the admin can break — the owner can draw a
// short game, deliberately, and the winner row records that it happened.
// Every buyer who ticked the old consent was told something the system
// does not guarantee. The clause now says both halves, and the full rules
// say it again at greater length. If the early-draw control is ever taken
// away, this is one of the sentences that changes back.

export const GAME_TERMS = [
  "This game runs until all spots are sold. There is no end date and no countdown.",
  "All spot purchases are final. No refunds, no exchanges, no transfers.",
  "The winner is drawn once the last spot sells. The shop may draw earlier at its discretion; if it does, the game says so.",
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
export const GAME_TERMS_VERSION = "2026-09-agency-2";

/** The checkbox label. Says what is being agreed to, not "I agree". */
export const GAME_TERMS_CONSENT =
  "I understand this game has no end date, that the shop may draw before every spot sells, and that my purchase is final.";

// SHOW_NAME_LABEL and SHOW_NAME_HELP lived here and are gone with the
// board they belonged to. There is no opt-in at checkout because there is
// nowhere a buyer's name could appear: the public page shows how many
// spots remain out of the total and nothing else.
