// Which of the three public surfaces a thing appears on.
//
// THE QUESTION THIS ANSWERS
//
// Does an item need a flag saying where it belongs, or can it be derived?
// It can be derived — but NOT from whether it has a price, which is the
// obvious derivation and the wrong one.
//
// Deriving from price is ambiguous in both directions, and both are
// silent:
//
//   An unpriced t-shirt falls through to "in the case". Apparel appears
//   in the firearms display. The owner sees nothing wrong; he just hasn't
//   set the price yet.
//
//   A priced firearm lands in the Shop with a Buy button. That one is not
//   a cosmetic error. Firearms are transferred through an FFL with a
//   background check, and the price field is exactly the kind of thing an
//   owner fills in because it looks like it wants a number.
//
// Category has neither problem. It is already mandatory, the owner
// already chooses it, and — unlike a blank price — it cannot be silently
// absent. So the rule is category first, with one override:
//
//   attached to a game  -> GAMES      (wherever else it would have gone)
//   firearm category    -> IN_THE_CASE
//   everything else     -> SHOP
//
// The game override comes first because a rifle put up as a prize is on
// the Games surface for as long as the game exists and afterwards as history,
// which is the client's instruction.
//
// Two guards stop the derivation being defeated, because a rule nothing
// enforces is a convention:
//
//   The admin does not offer an online price on a firearm category, and
//   the database refuses one (items_firearms_have_no_online_price). A
//   firearm cannot acquire a cart even if a future query forgets to ask
//   about surfaces.
//
//   The Shop hides items with no price, because an item in a shop that
//   cannot be bought is a dead end. The admin says so against the item
//   rather than leaving the owner to wonder where it went.

import type { Database } from "@/lib/database.types";

export type Surface = "shop" | "games" | "case";

/**
 * The categories that are firearms in the sense that matters here: they
 * cannot be posted, cannot be sold by cart, and require a transfer.
 *
 * Deliberately NOT the same list as DISCLAIMER_CATEGORIES, which includes
 * ammunition. Ammunition carries the attorney's notice AND is sold in the
 * shop; the two questions are different and sharing one list would tie
 * them together for no reason.
 */
export const FIREARM_CATEGORIES = [
  "pistol",
  "revolver",
  "rifle",
  "shotgun",
  "pcc",
] as const;

export function isFirearmCategory(category: string): boolean {
  return (FIREARM_CATEGORIES as readonly string[]).includes(category);
}

type ItemLike = {
  category: string;
  price_cents?: number | null;
};

/**
 * Where this item belongs.
 *
 * `inAGame` is passed in rather than read here because the caller already
 * knows — it has just queried games, or it has not and does not care.
 * Making this function fetch would make every list view N+1.
 */
export function surfaceFor(item: ItemLike, inAGame = false): Surface {
  if (inAGame) return "games";
  if (isFirearmCategory(item.category)) return "case";
  return "shop";
}

/**
 * Can a customer actually buy this?
 *
 * Separate from the surface on purpose. An unpriced t-shirt is a Shop
 * item that is not yet for sale, which is a different statement from "it
 * belongs in the gun case", and the admin needs to be able to say the
 * first one.
 */
export function isPurchasable(item: ItemLike): boolean {
  return !isFirearmCategory(item.category) && (item.price_cents ?? null) !== null;
}

/** What the owner is told when an item will not appear where he expects. */
export function whyNotVisible(
  item: ItemLike,
  inAGame = false,
): string | null {
  if (inAGame) return null;
  if (isFirearmCategory(item.category)) return null;
  if ((item.price_cents ?? null) === null) {
    return "No price, so it does not appear in the Shop. Add one and it goes live.";
  }
  return null;
}

export const SURFACE_LABEL: Record<Surface, string> = {
  shop: "Shop",
  games: "Games",
  case: "In the case",
};

/**
 * The one-line explanation at the top of each admin section, in the
 * owner's language rather than ours. He should never have to work out
 * which section a new product belongs in.
 */
export const SURFACE_BLURB: Record<Surface, string> = {
  shop:
    "Things customers buy directly — apparel, accessories, ammunition, optics. Set a price and it appears in the Shop.",
  games:
    "Games. Pick the prize, say how many spots and what a spot costs, and customers buy spots until it sells out.",
  case:
    "Firearms on the shelf at the shop. No price and no cart — customers send an enquiry and you handle it in person.",
};

/**
 * Ground colour per surface, shared by the public home page and the admin.
 *
 * The point is that the owner looking at the green section in the admin
 * knows it is the same thing customers see under green. The tokens are
 * the existing ones; only the assignment is new.
 *
 * `acid` as a FIELD rather than an accent is a deliberate exception,
 * granted for the home page section grounds and the admin sections that
 * mirror them. It does not extend to controls — a button is still bone on
 * ink, and acid stays a pointer everywhere else.
 */
export const SURFACE_GROUND: Record<Surface, string> = {
  shop: "ground-ink",
  games: "ground-acid",
  case: "ground-neutral",
};

export type GameRow = Database["public"]["Tables"]["games"]["Row"];

/**
 * A demonstration game, created from the admin so the client can see a
 * populated Past games section before a real draw exists.
 *
 * Detected from the title rather than a column, deliberately: a flag in
 * the database is invisible, and the failure to avoid is not an
 * unconvincing demo — it is a demo still sitting there in six months
 * while a customer reads it as a draw that happened. A title nobody can
 * miss is the point, and it survives being copied into a screenshot.
 */
export const DEMO_GAME_PREFIX = "[DEMO]";

export function isDemoGame(title: string): boolean {
  return title.trim().toUpperCase().startsWith(DEMO_GAME_PREFIX);
}

/** The title without its marker, for headings that show the badge separately. */
export function demoStrippedTitle(title: string): string {
  return isDemoGame(title) ? title.trim().slice(DEMO_GAME_PREFIX.length).trim() : title;
}
