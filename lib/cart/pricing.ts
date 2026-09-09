import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import { itemImages } from "@/lib/db/items";
import {
  MAX_QUANTITY,
  lineKey,
  type CartLine,
  type FulfillmentType,
  type PricedCart,
  type PricedLine,
  type RejectedLine,
} from "./types";

/**
 * Owner-set commerce settings, in the same key/value table as the game
 * settings, editable at /admin/commerce.
 *
 * The tax rate is real: 8.25% is the El Paso combined rate, given to us by
 * the client. The two shipping figures are PLACEHOLDERS — the client is
 * still deciding — and the admin screen says so on screen rather than
 * presenting them as settled.
 */
export const COMMERCE_DEFAULTS = {
  taxRateBps: 825,
  shippingStandardCents: 1000,
  shippingOversizeCents: 2000,
};

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
    shippingStandardCents: int(
      raw.shipping_standard_cents,
      COMMERCE_DEFAULTS.shippingStandardCents,
    ),
    shippingOversizeCents: int(
      raw.shipping_oversize_cents,
      COMMERCE_DEFAULTS.shippingOversizeCents,
    ),
  };
}

/**
 * Postage for a whole order, charged once at the highest tier present.
 *
 * Not per line: two t-shirts go in one envelope, and billing twice for
 * that is the kind of thing people notice and resent. A cart holding a
 * shirt and a gun safe pays the safe's rate, because that is what the
 * shipment actually costs.
 *
 * Collected items contribute nothing — they are not being posted.
 */
export function shippingFor(
  lines: { fulfillment: FulfillmentType; oversize: boolean }[],
  settings: CommerceSettings,
): number {
  const shipped = lines.filter((l) => l.fulfillment === "ship");
  if (shipped.length === 0) return 0;
  return shipped.some((l) => l.oversize)
    ? settings.shippingOversizeCents
    : settings.shippingStandardCents;
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
  needsSize: "Pick a size for this one.",
  sizeGone: "That size has sold out.",
  noSizes: "No sizes are in stock.",
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

  // Collapse duplicates before hitting the database. Keyed by item AND
  // size, so adding a medium twice is a quantity while adding a medium
  // and a large stays two lines.
  const wanted = new Map<string, { itemId: string; variantId: string | null; quantity: number }>();
  for (const line of lines) {
    const qty = Math.floor(line.quantity);
    if (!line.itemId || !Number.isFinite(qty) || qty < 1) continue;
    const variantId = line.variantId ?? null;
    const key = lineKey({ itemId: line.itemId, variantId });
    const existing = wanted.get(key);
    if (existing) existing.quantity += qty;
    else wanted.set(key, { itemId: line.itemId, variantId, quantity: qty });
  }
  if (wanted.size === 0) return empty;

  const itemIds = [...new Set([...wanted.values()].map((w) => w.itemId))];
  const { data: rows, error } = await sb.from("items").select("*").in("id", itemIds);
  if (error) {
    logDbError("priceCart", error);
    return empty;
  }

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));

  // Sizes, for the items that have them. Re-read here rather than trusted
  // from the browser: the stock figure decides whether this sale can
  // happen at all.
  const sizedIds = (rows ?? []).filter((r) => r.has_variants).map((r) => r.id);
  const variantsByItem = new Map<string, { id: string; size: string; stock: number }[]>();
  if (sizedIds.length > 0) {
    const { data: variantRows, error: variantError } = await sb
      .from("item_variants")
      .select("id, item_id, size, stock")
      .in("item_id", sizedIds);
    if (variantError) logDbError("priceCart variants", variantError);
    for (const v of variantRows ?? []) {
      variantsByItem.set(v.item_id, [
        ...(variantsByItem.get(v.item_id) ?? []),
        { id: v.id, size: v.size, stock: v.stock },
      ]);
    }
  }

  const priced: PricedLine[] = [];
  const rejected: RejectedLine[] = [];
  // Kept beside the priced lines rather than on them: the tier is a
  // postage input, not something a buyer ever sees on a cart row.
  const oversizeItems = new Set<string>();

  for (const [key, { itemId, variantId, quantity: requested }] of wanted) {
    const item = byId.get(itemId);
    if (!item) {
      rejected.push({ key, itemId, name: null, reason: REJECTION.missing });
      continue;
    }
    if (item.status !== "available") {
      rejected.push({ key, itemId, name: item.name, reason: REJECTION.unavailable });
      continue;
    }
    if (item.price_cents == null || item.price_cents <= 0) {
      rejected.push({ key, itemId, name: item.name, reason: REJECTION.unpriced });
      continue;
    }

    const fulfillment = (
      item.fulfillment_type === "ship" ? "ship" : "pickup"
    ) as FulfillmentType;

    let size: string | null = null;
    let cap: number = MAX_QUANTITY[fulfillment];

    if (item.has_variants) {
      const options = variantsByItem.get(itemId) ?? [];
      if (options.length === 0) {
        // Ticked as sized but nothing typed in yet, so there is no size
        // to sell. Reads to the buyer as unavailable, which it is.
        rejected.push({ key, itemId, name: item.name, reason: REJECTION.noSizes });
        continue;
      }
      const chosen = variantId ? options.find((o) => o.id === variantId) : null;
      if (!chosen) {
        rejected.push({ key, itemId, name: item.name, reason: REJECTION.needsSize });
        continue;
      }
      if (chosen.stock <= 0) {
        rejected.push({ key, itemId, name: item.name, reason: REJECTION.sizeGone });
        continue;
      }
      size = chosen.size;
      // Stock is the real ceiling; MAX_QUANTITY is only the outer bound.
      cap = Math.min(cap, chosen.stock);
    } else if (variantId) {
      // A size on an item that has none is a stale cart or a hand-crafted
      // post. Drop the size rather than the line.
      size = null;
    }

    const quantity = Math.max(1, Math.min(requested, cap));
    if (item.shipping_tier === "oversize") oversizeItems.add(itemId);

    priced.push({
      itemId,
      variantId: item.has_variants ? variantId : null,
      size,
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
  const shippingCents = shippingFor(
    priced.map((l) => ({
      fulfillment: l.fulfillment,
      oversize: oversizeItems.has(l.itemId),
    })),
    settings,
  );
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
