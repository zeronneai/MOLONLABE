// The terms of buying a guide.
//
// These deliberately do NOT live in lib/legal.ts. That file holds the
// attorney's wording and is not edited; these are the agency's, and
// mixing the two in one file would blur whose words are whose.
//
// Three facts the buyer has to have seen before paying, and nothing
// else: there is no end date, the drop ends when it sells out, and the
// money does not come back. Plus, since 2026-09-26, that their name is
// shown when the drawing is broadcast.
//
// 2026-09-agency-3: the attorney's ruling on terminology. A spot is a
// guide and a game is a drop.
//
// 2026-09-agency-4: the client's decisions of 26 September. The early
// draw is gone everywhere (the admin cannot do it and the database
// refuses it), so the third line no longer says the shop may draw
// earlier. The broadcast acknowledgement is new.
//
// Orders placed before keep the wording they were shown, because it is
// stored on the order, which is the point of storing it.
export const GAME_TERMS = [
  "This drop runs until every guide is sold. There is no end date and no countdown.",
  "All guide purchases are final. No refunds, no exchanges, no transfers.",
  "The winner is drawn once the last guide sells.",
] as const;

/**
 * The broadcast acknowledgement. The client's wording, 2026-09-26,
 * verbatim.
 *
 * Its own required checkbox at checkout, beside the terms above, because
 * it is a different thing to agree to: not how the drop works, but that
 * the buyer's name goes on a public video. It is stored on the order as
 * part of game_terms_text, and hasBroadcastConsent reads it back from
 * there. An order whose stored text does not contain this sentence was
 * placed before it existed, and that buyer has not agreed.
 */
export const BROADCAST_NOTICE =
  "The drawing is broadcast live on Instagram and saved as a reel. Your first name and last initial will appear on screen.";

/** The checkbox label for the broadcast acknowledgement. */
export const BROADCAST_CONSENT =
  "I understand my first name and last initial will appear on screen in the drawing, broadcast live on Instagram and saved as a reel.";

/**
 * The text stored on the order beside its acceptance timestamp. A
 * timestamp without the words it refers to proves only that somebody
 * clicked something, so the two are always written together. Both
 * checkboxes are required, so both parts are always present on a new
 * order.
 */
export const GAME_TERMS_TEXT = [...GAME_TERMS, BROADCAST_NOTICE].join(" ");

/**
 * Bumped whenever GAME_TERMS or BROADCAST_NOTICE changes, so a stack of
 * orders can be grouped by which wording was in force without diffing
 * strings.
 */
export const GAME_TERMS_VERSION = "2026-09-agency-4";

/** The checkbox label. Says what is being agreed to, not "I agree". */
export const GAME_TERMS_CONSENT =
  "I understand this drop has no end date, that the winner is drawn once every guide sells, and that my purchase is final.";

/**
 * Whether the order's stored terms include the broadcast acknowledgement.
 * Anything else, including an order with no stored terms at all, is
 * treated as not having agreed.
 */
export function hasBroadcastConsent(storedTerms: string | null | undefined): boolean {
  return typeof storedTerms === "string" && storedTerms.includes(BROADCAST_NOTICE);
}

// SHOW_NAME_LABEL and SHOW_NAME_HELP lived here and are gone with the
// board they belonged to. The public drop page shows how many guides
// remain out of the total and no names. The places a buyer's name does
// appear are the drawing (BROADCAST_NOTICE above) and, for the winner,
// the past drops list.
