export const ITEM_STATUSES = ["available", "reserved", "sold", "hidden"] as const;
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
