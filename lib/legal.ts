// Legal copy shown at purchase. One source of truth, imported everywhere
// it appears, so the three placements can never drift apart.
//
// FIREARM_DISCLAIMER is the client's attorney's text, verbatim. Do not
// edit it, reflow it, "improve" the punctuation, or split it across
// elements for layout. If it needs to change, it changes at the attorney,
// and then here, and the version constant below moves with it.
//
// It appears in exactly three places, per the client's instruction:
//   1. The product page      — components/inventory/PurchasePanel.tsx
//   2. Checkout, as a required checkbox that blocks payment until ticked
//   3. The confirmation email — lib/email/orderConfirmation.ts
//
// The order record stores the accepted text alongside the timestamp. That
// pairing is the thing that actually protects the client: a timestamp
// without the text it refers to proves only that somebody clicked
// something.

export const FIREARM_DISCLAIMER =
  "Know your state and local laws before purchasing. All firearm sales and transfers are subject to applicable federal, state, and local laws. It is the purchaser's responsibility to ensure the firearm and/or related items are legal to possess in their jurisdiction. All applicable firearms must be transferred through a federally licensed firearms dealer (FFL). No sales or transfers will be completed where prohibited by law.";

/**
 * Bumped whenever FIREARM_DISCLAIMER changes. Stored on the order next to
 * the full text, so a stack of orders can be grouped by which wording was
 * in force without diffing strings.
 */
export const DISCLAIMER_VERSION = "2026-09-attorney-1";

/**
 * PLACEHOLDER — the client owes us final wording for this one.
 *
 * The substance was specified ("a no refunds or exchanges line"), so the
 * line is here and is stored on every order; only the exact phrasing is
 * pending. It is deliberately plain rather than written to sound final,
 * so nobody mistakes it for approved copy. Tracked in
 * docs/content-needed.md.
 */
export const REFUND_POLICY =
  "All sales are final. No refunds or exchanges.";

export const REFUND_POLICY_IS_PLACEHOLDER = true;

/**
 * Shown against every pickup line, in the cart, at checkout and in the
 * confirmation.
 *
 * This wording is mine, not the attorney's — the client asked for a line
 * making clear that paying is not the same as completing the sale, and
 * this is my attempt at it. It should go past the attorney with the rest.
 * The failure it exists to prevent is somebody driving to Montana Ave
 * believing the transaction is already done.
 */
export const PICKUP_NOTICE =
  "Paying online does not complete this sale. Firearms are collected in person at the shop, where the federal background check and any applicable waiting period take place. We cannot release a firearm until that clears.";

/** Shown against shipped lines, so the two routes read as deliberate. */
export const SHIPPING_NOTICE =
  "Ships to the address you give at checkout. Nothing in this group requires a background check.";

// ---------------------------------------------------------------------
// The no-purchase route: removed
// ---------------------------------------------------------------------
//
// `ENTRY_CLAIM` and `freeEntryStep` lived here and are gone. The client
// confirmed nothing about a game will be free, so every sentence
// asserting a person could enter without buying is now false and has been
// removed from the site.
//
// They were centralised here precisely so this removal could be done in
// one pass and be provably complete: deleting the keys made TypeScript
// name every remaining place that made the claim and the build stayed
// broken until each had been dealt with. That was the point of gathering
// them. By the time the client confirmed, the fixed-pool rebuild had
// already taken most of them out, so the compiler named four usages
// across two files rather than the twelve it would have named in August.
//
// What this does NOT do, and must not: the official rules page still
// carries a checklist item for the attorney. It has been rewritten to
// describe the entry method as purchase-only rather than deleted, because
// a rules document that simply omits the question reads as an oversight.
// The attorney needs to see that the decision was made.
//
// If a free route ever returns, it does not come back as scattered
// sentences. It comes back here first.
