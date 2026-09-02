// Money is integer cents everywhere it is arithmetic, and a formatted
// string only at the edge where a human reads it. There is no float in
// between; `19.99 * 3` is not 59.97 in binary floating point and a cart
// that believes it is will eventually charge the wrong amount.

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Gateways want a decimal string, not cents. Two places, always. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parses owner input ("1299.00", "$1,299") into cents. Returns null on
 * anything it cannot read, so a typo becomes an unpriced item rather than
 * a wrong price.
 */
export function parseUsdToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}
