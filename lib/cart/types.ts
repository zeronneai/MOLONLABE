// Cart shapes shared by the browser store and the server pricer.
//
// Note what a stored cart line does NOT contain: a price. The browser
// keeps ids and quantities and nothing else. Every amount on every screen
// is computed server-side from the database, so a tampered localStorage
// or a hand-crafted POST can change what someone is buying but never what
// it costs. This is the single most important property in the checkout.

export type FulfillmentType = "ship" | "pickup";

/** What the browser persists. Ids and counts only. */
export type CartLine = {
  itemId: string;
  quantity: number;
  /**
   * Which size, for items that come in sizes. Null for everything else —
   * a rifle has no variant and never grows one.
   */
  variantId?: string | null;
};

/**
 * A cart holds one line per item *and size*: two of a shirt in medium and
 * one in large are two lines, not one. Everything that adds, removes or
 * re-counts keys off this rather than the item id alone.
 */
export function lineKey(line: { itemId: string; variantId?: string | null }): string {
  return `${line.itemId}:${line.variantId ?? ""}`;
}

/** One line after the server has resolved and priced it. */
export type PricedLine = {
  itemId: string;
  variantId: string | null;
  /** The size as text, snapshotted for display. Null when not sized. */
  size: string | null;
  slug: string;
  name: string;
  image: string | null;
  unitPriceCents: number;
  quantity: number;
  fulfillment: FulfillmentType;
  lineTotalCents: number;
};

/** A line the server refused, and why, so the cart can say so out loud. */
export type RejectedLine = {
  /** lineKey of the line that was refused, so it can be removed exactly. */
  key: string;
  itemId: string;
  name: string | null;
  reason: string;
};

export type PricedCart = {
  lines: PricedLine[];
  rejected: RejectedLine[];
  shipLines: PricedLine[];
  pickupLines: PricedLine[];
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  hasShipment: boolean;
  hasPickup: boolean;
  /** Entries this cart would earn, floored to whole dollars. */
  entriesEarned: number;
  entriesPerDollar: number;
  campaign: { id: string; title: string } | null;
};

/**
 * Firearms are listed as individual units — the status column flips one
 * row from available to sold — so a pickup line is always exactly one.
 * Shipped goods can be bought in multiples.
 *
 * For an item with sizes this is only the outer bound: the real cap is
 * that size's stock count, applied in the pricer. Items without sizes
 * still have no stock figure at all, so a shipped one can be over-ordered
 * up to this number — see docs/content-needed.md.
 */
export const MAX_QUANTITY = { pickup: 1, ship: 10 } as const;

/** One size of one item, as the public pages need it. */
export type VariantOption = {
  id: string;
  size: string;
  /** Sold out sizes stay on screen, disabled — absence is information. */
  inStock: boolean;
};
