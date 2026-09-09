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
// The entry program's no-purchase claims
// ---------------------------------------------------------------------
//
// Every sentence on the site that asserts a person can enter without
// buying anything. They were written in eight different files and drifted
// already — the same claim appeared as both "No purchase necessary to
// enter" and "No purchase is necessary to enter".
//
// They are gathered here for one reason: the client has asked twice to
// remove the no-purchase method, and it is with his attorney. If that
// model changes, every one of these becomes false at the same moment, and
// one of them now lives in a customer's inbox rather than on a page we
// control. Scattered, that is a copy hunt with no way to know it finished.
//
// To remove the claim: delete the key. TypeScript then names every place
// that asserted it and the build fails until each has been dealt with
// deliberately — a claim about a prize draw should not be removable by
// forgetting. Verified: emptying this object produces 12 errors across
// four files, which is every site that makes the claim.
//
// The exception is `freeEntryStep` below, which is a function rather than
// a key. Its two sentences make the same claim and have to be rewritten
// by hand; nothing will fail the build for them. It is here so that the
// hand edit is in the same file as everything else.
//
// Nothing here is the attorney's text. It is my wording of a standard
// disclosure and should be read alongside the rules when he returns them.
export const ENTRY_CLAIM = {
  /**
   * The short form: a link label on the product page, in the cart and on
   * the receipt, and the sentence in the confirmation email that carries
   * a URL after it. One string for all four — this is where the two
   * spellings were.
   */
  link: "No purchase necessary to enter",

  /** The full disclosure. Footnotes, and the head of the rules page. */
  statement:
    "No purchase necessary to enter or win. A purchase does not improve your chances of winning. Void where prohibited.",

  /** Compressed, for page metadata and search results. */
  short: "No purchase necessary.",

  /** The free entry form's own heading. */
  formLabel: "Free entry — no purchase necessary",

  /** The form's standing explanation of what a free entry is worth. */
  formBody:
    "A free entry counts the same as a purchased one. Fill this in and you are entered — there is nothing else to do, nothing to buy, and no step behind this one.",

  /** Shown after a free entry lands, when the server sends no message. */
  received:
    "One entry, no purchase, same odds per entry as any other. We'll email the winner and post the result here.",
} as const;

/**
 * Step one of "how it works" on /featured.
 *
 * A function because the sentence changes shape with the campaign's rate,
 * and both shapes make the same claim — so both belong here rather than
 * one being centralised and the other left behind in the page.
 */
export function freeEntryStep(entriesPerDollar: number): {
  title: string;
  body: string;
} {
  if (entriesPerDollar <= 0) {
    return {
      title: "Enter free",
      body: "One entry, no purchase, no catch. Fill in the form below and you are in the draw.",
    };
  }
  return {
    title: "Enter free, or shop",
    body: `One entry, no purchase, no catch — the form below is all it takes. Every dollar you spend in the shop earns ${
      entriesPerDollar === 1 ? "another entry" : `${entriesPerDollar} more`
    } on top. A free entry is worth exactly what an earned one is worth.`,
  };
}
