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
import { MAX_SPOTS_PER_ORDER } from "@/lib/games/types";

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

const REJECTION = {
  missing: "No longer listed.",
  unavailable: "No longer available.",
  unpriced: "Not sold online — call the shop for this one.",
  needsSize: "Pick a size for this one.",
  sizeGone: "That size has sold out.",
  noSizes: "No sizes are in stock.",
  oneGame: "Spots in one game at a time — this cart already holds another.",
  gameClosed: "That game has sold out. Nothing has been charged.",
  spotCap: `${MAX_SPOTS_PER_ORDER} spots is the most in one order.`,
} as const;

/**
 * Entries earned, floored to whole dollars of merchandise.
 *
 * Tax and shipping are excluded deliberately: nobody should earn
 * sweepstakes entries on sales tax, and a shipping charge is not spend on
 * the shop's goods. $47.60 at one per dollar is 47 entries, not 47.6 and
 * not 48.
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
    spotGame: null,
    spotCount: 0,
  };
  if (!sb || lines.length === 0) return empty;

  // ------------------------------------------------------------- spots
  //
  // One game per cart, by construction. Spots in two games in one
  // transaction would make the claim-then-charge dance span two pools,
  // and a half-failed charge would leave one of them holding spots for a
  // sale that never happened. The first game in the cart wins; the rest
  // are refused out loud rather than silently dropped.
  const rejectedSpots: RejectedLine[] = [];
  let spotGame: PricedCart["spotGame"] = null;
  let spotCount = 0;
  const spotLines: PricedLine[] = [];

  const gameWanted = new Map<string, number>();
  for (const line of lines) {
    if (!line.gameId) continue;
    const qty = Math.floor(line.quantity);
    if (!Number.isFinite(qty) || qty < 1) continue;
    gameWanted.set(line.gameId, (gameWanted.get(line.gameId) ?? 0) + qty);
  }

  if (gameWanted.size > 0) {
    const [firstGameId, requested] = [...gameWanted.entries()][0];
    for (const extra of [...gameWanted.keys()].slice(1)) {
      rejectedSpots.push({
        key: lineKey({ gameId: extra }),
        itemId: extra,
        name: null,
        reason: REJECTION.oneGame,
      });
    }

    const { data: game, error: gameError } = await sb
      .from("games")
      .select("id, title, status, total_spots, spot_price_cents")
      .eq("id", firstGameId)
      .maybeSingle();
    if (gameError) logDbError("priceCart game", gameError);

    if (!game) {
      rejectedSpots.push({
        key: lineKey({ gameId: firstGameId }),
        itemId: firstGameId,
        name: null,
        reason: REJECTION.missing,
      });
    } else {
      // Read live rather than trusted from the page that rendered the
      // button. Between someone opening the game and pressing buy, the
      // last spot may have gone.
      const { data: remainingRaw } = await sb.rpc("game_spots_remaining", {
        p_game: game.id,
      });
      const remaining = Math.max(0, Math.min(game.total_spots, remainingRaw ?? 0));

      if (game.status !== "open" || remaining === 0) {
        rejectedSpots.push({
          key: lineKey({ gameId: game.id }),
          itemId: game.id,
          name: game.title,
          reason: REJECTION.gameClosed,
        });
      } else {
        // Trimmed to what is actually left, and said out loud when it is
        // less than was asked for — silently selling three of five spots
        // is how somebody ends up surprised at the total.
        const cap = Math.min(remaining, MAX_SPOTS_PER_ORDER);
        spotCount = Math.max(1, Math.min(requested, cap));
        if (spotCount < requested) {
          rejectedSpots.push({
            key: lineKey({ gameId: game.id }),
            itemId: game.id,
            name: game.title,
            reason:
              remaining < requested
                ? `Only ${remaining} ${remaining === 1 ? "spot" : "spots"} left, so the cart holds ${spotCount}.`
                : REJECTION.spotCap,
          });
        }
        spotGame = {
          id: game.id,
          title: game.title,
          spotPriceCents: game.spot_price_cents,
          totalSpots: game.total_spots,
          remaining,
        };
        spotLines.push({
          gameId: game.id,
          spotCount,
          itemId: game.id,
          variantId: null,
          size: null,
          slug: `game-${game.id}`,
          name: `${game.title} — ${spotCount === 1 ? "1 spot" : `${spotCount} spots`}`,
          image: null,
          unitPriceCents: game.spot_price_cents,
          quantity: spotCount,
          // Not posted, not collected. See FulfillmentType.
          fulfillment: "none",
          lineTotalCents: game.spot_price_cents * spotCount,
        });
      }
    }
  }

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
  if (wanted.size === 0 && spotLines.length === 0) {
    return { ...empty, rejected: rejectedSpots };
  }

  const itemIds = [...new Set([...wanted.values()].map((w) => w.itemId))];
  const { data: rows, error } =
    itemIds.length > 0
      ? await sb.from("items").select("*").in("id", itemIds)
      : { data: [], error: null };
  if (error) {
    logDbError("priceCart", error);
    return { ...empty, rejected: rejectedSpots };
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
  const rejected: RejectedLine[] = [...rejectedSpots];
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
      gameId: null,
      spotCount: 0,
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

  // Spots first, so they read above the merchandise on the cart — they
  // are the reason most of these carts exist.
  priced.unshift(...spotLines);

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
    spotGame,
    spotCount,
  };
}
