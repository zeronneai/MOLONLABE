"use server";

// The cart lives in the browser, but every number on it comes from here.
// The client posts what it holds — ids and quantities — and gets back a
// fully priced cart it can only display, never compute.

import { priceCart } from "@/lib/cart/pricing";
import type { CartLine, PricedCart } from "@/lib/cart/types";

export async function quoteCart(lines: CartLine[]): Promise<PricedCart> {
  // Bounded before it reaches the database: an unbounded array from the
  // browser is an unbounded `in (...)` query.
  const safe = Array.isArray(lines) ? lines.slice(0, 50) : [];
  return priceCart(safe);
}
