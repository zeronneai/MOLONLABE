export const ITEM_STATUSES = ["available", "reserved", "sold", "hidden"] as const;
// The three states a live item moves between. `hidden` is not a peer of
// these — it is the archived state, reached by the Archive action and left
// by Restore, so it is kept out of the status toggle group.
export const ITEM_LIVE_STATUSES = ["available", "reserved", "sold"] as const;
export const ARCHIVED_STATUS = "hidden";
export const PRODUCT_BUCKET = "product-images";
/**
 * A game's three states, and it is never set by hand.
 *
 * `open` from creation, `full` the moment the last spot sells (inside the
 * same statement that sells it), `drawn` once a winner is recorded. There
 * is no draft and no closing date — the game ends when it fills.
 */
export const GAME_STATUSES = ["open", "full", "drawn"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];
/**
 * Ordered the way a counter is walked: handguns, long guns, what feeds
 * them, glass, then everything else.
 *
 * Audited against what this shop actually stocks rather than what the
 * seed file happened to contain. Added: `shotgun`, which was a plain
 * omission — no gun shop in Texas is without them; `ammunition`, which
 * was the highest-turnover thing on the counter with nowhere to live;
 * `magazine`, which people search for by name and which would otherwise
 * disappear into "accessory"; and `apparel`.
 *
 * Deliberately NOT added: suppressors and anything else NFA, which need
 * an SOT and a different transfer process entirely — putting them in a
 * dropdown would imply the shop can sell them; and holsters, slings and
 * cleaning kit, which sit under `accessory` without loss.
 */
export const CATEGORIES = [
  "pistol",
  "revolver",
  "rifle",
  "shotgun",
  "pcc",
  "ammunition",
  "magazine",
  "optic",
  "accessory",
  "apparel",
] as const;

/**
 * What lives at /shop rather than /inventory.
 *
 * The line is not "small things" — it is what ships without a legal
 * conversation. Ammunition looks like it belongs here until you remember
 * it cannot go to every state, and magazines carry capacity limits in
 * several. Both stay in the inventory, where the fulfilment choice is
 * made deliberately per item.
 *
 * Moving a category between the two listings is this one line.
 */
export const SHOP_CATEGORIES = ["apparel", "accessory"] as const;

/**
 * Which categories carry the attorney's firearms notice on their product
 * page.
 *
 * Firearms and ammunition only. It used to be on everything, which meant
 * it appeared on t-shirts — and a legal notice that turns up everywhere
 * becomes one nobody reads, which weakens it exactly where it has to
 * work. Magazines and optics are out because the notice is about
 * transfers through an FFL, which is not what they are.
 *
 * The checkout checkbox is separate and still applies to every order,
 * because a cart can mix a shirt and a pistol.
 */
export const DISCLAIMER_CATEGORIES = [
  "pistol",
  "revolver",
  "rifle",
  "shotgun",
  "pcc",
  "ammunition",
] as const;

export function needsFirearmDisclaimer(category: string): boolean {
  return (DISCLAIMER_CATEGORIES as readonly string[]).includes(category);
}

/** Shipping tiers. Only meaningful for items that ship. */
export const SHIPPING_TIERS = ["standard", "oversize"] as const;

export function isShopCategory(category: string): boolean {
  return (SHOP_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Apparel is the one category that is always posted, so the form starts
 * there instead of at the cautious default. Everything else keeps
 * `pickup` until the owner says otherwise — the safe direction, since a
 * wrong guess the other way would put a firearm in the mail.
 */
export function defaultFulfillment(category: string): "ship" | "pickup" {
  return category === "apparel" ? "ship" : "pickup";
}

export type ActionState = { status: "idle" | "error"; message?: string };

// Never let the exclusions note go empty: a discount with no stated
// limits is a discount on everything.
export const DEFAULT_EXCLUSION_NOTE =
  "Accessories and apparel only. Not valid on firearms.";
