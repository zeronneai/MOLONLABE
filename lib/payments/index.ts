// Payment provider seam. Checkout is blocked on Fortis, so nothing here
// charges anything yet — but the entry program is written against this
// interface rather than around it, so bringing the paid path online is a
// matter of implementing one object and setting PAYMENTS_PROVIDER.
//
// Entry packs are the only product: a pack grants N entries to a
// campaign. A pack is never the ONLY way in — see the free method in
// components/entry/FreeEntry.tsx, which is always live.

export interface EntryPack {
  id: string;
  label: string;
  entries: number;
  priceUsd: number;
}

export interface CheckoutRequest {
  campaignId: string;
  pack: EntryPack;
  email: string;
  returnUrl: string;
}

export interface CheckoutSession {
  /** Where to send the buyer to complete payment. */
  url: string;
  reference: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** False until real credentials exist; the UI reads this, never guesses. */
  readonly configured: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}

/**
 * The provider in force until Fortis is wired. It reports itself
 * unconfigured so the UI can say so plainly, and throws if anything tries
 * to take money through it anyway.
 */
export const unconfiguredProvider: PaymentProvider = {
  name: "none",
  configured: false,
  async createCheckout() {
    throw new Error(
      "No payment provider is configured. Entry packs cannot be sold yet.",
    );
  },
};

export function getPaymentProvider(): PaymentProvider {
  // When Fortis lands: read PAYMENTS_PROVIDER and return that implementation.
  return unconfiguredProvider;
}

// Shown on the featured page so the offer is legible even while checkout
// is closed. Prices are the client's to confirm.
export const ENTRY_PACKS: EntryPack[] = [
  { id: "pack-5", label: "5 entries", entries: 5, priceUsd: 25 },
  { id: "pack-15", label: "15 entries", entries: 15, priceUsd: 50 },
  { id: "pack-40", label: "40 entries", entries: 40, priceUsd: 100 },
];
