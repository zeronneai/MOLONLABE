export const ITEM_STATUSES = ["available", "reserved", "sold", "hidden"] as const;
// The three states a live item moves between. `hidden` is not a peer of
// these — it is the archived state, reached by the Archive action and left
// by Restore, so it is kept out of the status toggle group.
export const ITEM_LIVE_STATUSES = ["available", "reserved", "sold"] as const;
export const ARCHIVED_STATUS = "hidden";
export const PRODUCT_BUCKET = "product-images";
export const CAMPAIGN_STATUSES = ["draft", "live", "closed", "awarded"] as const;
export const CATEGORIES = [
  "pistol",
  "rifle",
  "revolver",
  "pcc",
  "optic",
  "accessory",
] as const;

export type ActionState = { status: "idle" | "error"; message?: string };

// Never let the exclusions note go empty: a discount with no stated
// limits is a discount on everything.
export const DEFAULT_EXCLUSION_NOTE =
  "Accessories and apparel only. Not valid on firearms.";
