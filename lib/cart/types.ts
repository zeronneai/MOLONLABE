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
};

/** One line after the server has resolved and priced it. */
export type PricedLine = {
  itemId: string;
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
 * KNOWN GAP: there is no stock count on items, so a shipped line can be
 * ordered in a quantity the shop does not have. The owner sees the order
 * and can call the buyer. Fixing it properly needs a stock column and is
 * tracked in docs/content-needed.md.
 */
export const MAX_QUANTITY = { pickup: 1, ship: 10 } as const;
