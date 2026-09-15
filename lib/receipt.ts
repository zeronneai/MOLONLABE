// Where a buyer's receipt lives, in one place.
//
// The order number alone is not enough to read an order — the token is
// the credential — so the two always travel together and the shape of
// that link is worth having in exactly one file. The checkout redirect,
// the confirmation email and anything that ever links back all agree by
// construction.

import { SITE_URL } from "@/lib/brand";

/** How long a receipt link stays good. Mirrors the column default in
 *  `20260917100000_receipt_link.sql` — this constant is for wording, the
 *  database is the authority on whether a given link still works. */
export const RECEIPT_TTL_LABEL = "one year";

export function receiptPath(orderNumber: string, token: string): string {
  return `/checkout/confirmation?order=${encodeURIComponent(
    orderNumber,
  )}&t=${encodeURIComponent(token)}`;
}

export function receiptUrl(orderNumber: string, token: string): string {
  return `${SITE_URL}${receiptPath(orderNumber, token)}`;
}

/**
 * The guide that came with the purchase.
 *
 * Same credential as the receipt, and for the same reason: there is no
 * account behind any of this, so the token the order issued is the only
 * thing that says who the reader is. Kept here beside `receiptPath`
 * rather than in lib/guides/ so that everything the buyer's token unlocks
 * is in one file and cannot drift into two shapes.
 *
 * The order number is in the path rather than the query so the URL reads
 * as a document, and `.pdf` is on the end so a browser that ignores the
 * Content-Disposition header still names the download sensibly.
 */
export function guidePath(orderNumber: string, token: string): string {
  return `/guide/${encodeURIComponent(orderNumber)}.pdf?t=${encodeURIComponent(token)}`;
}

export function guideUrl(orderNumber: string, token: string): string {
  return `${SITE_URL}${guidePath(orderNumber, token)}`;
}
