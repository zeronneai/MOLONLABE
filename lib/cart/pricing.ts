import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import { itemImages } from "@/lib/db/items";
import {
  MAX_QUANTITY,
  type CartLine,
  type FulfillmentType,
  type PricedCart,
  type PricedLine,
  type RejectedLine,
} from "./types";

/**
 * Owner-set commerce settings, in the same key/value table as the game
 * settings.
 *
 * Both default to zero on purpose. A sales-tax rate is a legal figure for
 * the client's jurisdiction and their accountant to state, and a shipping
 * charge is a commercial decision — inventing either would be worse than
 * charging nothing, because a wrong tax rate is a filing problem rather
 * than a rounding error. Zero is visibly wrong, which is the point: it
 * gets set before launch. Tracked in docs/content-needed.md.
 */
export const COMMERCE_DEFAULTS = { taxRateBps: 0, shippingFlatCents: 0 };

export type CommerceSettings = typeof COMMERCE_DEFAULTS;

export async function getCommerceSettings(
  sb: SupabaseClient<Database>,
): Promise<CommerceSettings> {
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", "commerce")
    .maybeSingle();
  const raw = (data?.value ?? {}) as Record<string, unknown>;
  const int = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  };
  return {
    taxRateBps: int(raw.tax_rate_bps, COMMERCE_DEFAULTS.taxRateBps),
    shippingFlatCents: int(
      raw.shipping_flat_cents,
      COMMERCE_DEFAULTS.shippingFlatCents,
    ),
  };
}

/**
 * Entries earned, floored to whole dollars of merchandise.
 *
 * Tax and shipping are excluded deliberately: nobody should earn
 * sweepstakes entries on sales tax, and a shipping charge is not spend on
 * the shop's goods. $47.60 at one per dollar is 47 entries, not 47.6 and
 * not 48.
 */
export function entriesFor(
  merchandiseCents: number,
  entriesPerDollar: number,
): number {
  if (entriesPerDollar <= 0 || merchandiseCents <= 0) return 0;
  return Math.floor(merchandiseCents / 100) * entriesPerDollar;
}

const REJECTION = {
  missing: "No longer listed.",
  unavailable: "No longer available.",
  unpriced: "Not sold online — call the shop for this one.",
} as const;

/**
 * Resolves a browser cart into real items at real prices.
 *
 * Everything here is re-read from the database on every call. The cart
 * the browser sends is treated purely as a list of things it would like
 * to buy; whether those things exist, are still available, are sold
 * online at all, and what they cost are all decided here. A line that
 * fails any of those checks is moved to `rejected` with a reason rather
 * than silently dropped, so the cart page can tell the buyer what
 * changed instead of quietly showing a different total than they
 * remember.
 */
export async function priceCart(
  lines: CartLine[],
  client?: SupabaseClient<Database>,
): Promise<PricedCart> {
  const sb = client ?? getSupabase();
  const empty: PricedCart = {
    lines: [],
    rejected: [],
    shipLines: [],
    pickupLines: [],
    subtotalCents: 0,
    taxCents: 0,
    shippingCents: 0,
    totalCents: 0,
    hasShipment: false,
    hasPickup: false,
    entriesEarned: 0,
    entriesPerDollar: 0,
    campaign: null,
  };
  if (!sb || lines.length === 0) return empty;

  // Collapse duplicates before hitting the database — two "add to cart"
  // taps on the same item is a quantity, not two lines.
  const wanted = new Map<string, number>();
  for (const line of lines) {
    const qty = Math.floor(line.quantity);
    if (!line.itemId || !Number.isFinite(qty) || qty < 1) continue;
    wanted.set(line.itemId, (wanted.get(line.itemId) ?? 0) + qty);
  }
  if (wanted.size === 0) return empty;

  const { data: rows, error } = await sb
    .from("items")
    .select("*")
    .in("id", [...wanted.keys()]);
  if (error) {
    logDbError("priceCart", error);
    return empty;
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const priced: PricedLine[] = [];
  const rejected: RejectedLine[] = [];

  for (const [itemId, requested] of wanted) {
    const item = byId.get(itemId);
    if (!item) {
      rejected.push({ itemId, name: null, reason: REJECTION.missing });
      continue;
    }
    if (item.status !== "available") {
      rejected.push({ itemId, name: item.name, reason: REJECTION.unavailable });
      continue;
    }
    if (item.price_cents == null || item.price_cents <= 0) {
      rejected.push({ itemId, name: item.name, reason: REJECTION.unpriced });
      continue;
    }

    const fulfillment = (
      item.fulfillment_type === "ship" ? "ship" : "pickup"
    ) as FulfillmentType;
    const quantity = Math.min(requested, MAX_QUANTITY[fulfillment]);

    priced.push({
      itemId,
      slug: item.slug,
      name: item.name,
      image: itemImages(item)[0] ?? null,
      unitPriceCents: item.price_cents,
      quantity,
      fulfillment,
      lineTotalCents: item.price_cents * quantity,
    });
  }

  const shipLines = priced.filter((l) => l.fulfillment === "ship");
  const pickupLines = priced.filter((l) => l.fulfillment === "pickup");
  const subtotalCents = priced.reduce((sum, l) => sum + l.lineTotalCents, 0);

  const settings = await getCommerceSettings(sb);
  const hasShipment = shipLines.length > 0;
  const shippingCents = hasShipment ? settings.shippingFlatCents : 0;
  // Tax on merchandise only. Whether this jurisdiction also taxes
  // shipping is a question for the client's accountant; with the rate at
  // zero it changes nothing today, and the narrower rule is the one that
  // cannot overcharge.
  const taxCents = Math.round((subtotalCents * settings.taxRateBps) / 10_000);

  const { data: campaign } = await sb
    .from("campaigns")
    .select("id, title, entries_per_dollar, closes_at")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const open =
    campaign && (!campaign.closes_at || new Date(campaign.closes_at) > new Date());
  const entriesPerDollar = open ? (campaign?.entries_per_dollar ?? 0) : 0;

  return {
    lines: priced,
    rejected,
    shipLines,
    pickupLines,
    subtotalCents,
    taxCents,
    shippingCents,
    totalCents: subtotalCents + taxCents + shippingCents,
    hasShipment,
    hasPickup: pickupLines.length > 0,
    entriesEarned: entriesFor(subtotalCents, entriesPerDollar),
    entriesPerDollar,
    campaign: open && campaign ? { id: campaign.id, title: campaign.title } : null,
  };
}
