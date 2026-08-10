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
