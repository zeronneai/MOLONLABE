import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import { FIREARM_CATEGORIES } from "@/lib/surfaces";
import type { ItemRow, ItemStatus } from "@/lib/database.types";
import type { IndexItem } from "@/components/inventory/EditorialIndex";
import type { VariantOption } from "@/lib/cart/types";

/**
 * PostgREST list literal for the firearm categories.
 *
 * These are the dividing line between the three public surfaces: a
 * firearm goes in the case, everything else is shop stock, and a game
 * overrides both. See lib/surfaces.ts for why the split is by category
 * and not by whether the thing has a price.
 */
const FIREARM_LIST = `(${FIREARM_CATEGORIES.join(",")})`;

// All reads go through the anon client; RLS already hides status='hidden',
// and the explicit filter here keeps intent obvious.

export async function getVisibleItems(): Promise<ItemRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("items")
    .select("*")
    .neq("status", "hidden")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("getVisibleItems", error);
    return [];
  }
  return data;
}

/**
 * In the case: firearms physically on the shelf at the shop.
 *
 * No price and no cart — these generate an enquiry. A firearm currently
 * attached to a game is excluded, because while it is in a game it
 * belongs on the Games surface; the caller passes those ids in.
 */
export async function getCaseItems(excludeIds: string[] = []): Promise<ItemRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb
    .from("items")
    .select("*")
    .neq("status", "hidden")
    .in("category", [...FIREARM_CATEGORIES]);
  if (excludeIds.length) q = q.not("id", "in", `(${excludeIds.join(",")})`);
  const { data, error } = await q
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("getCaseItems", error);
    return [];
  }
  return data;
}

/**
 * The Shop: everything a customer can put in a cart.
 *
 * Not a category allow-list any more — it is "not a firearm, and priced".
 * The price filter is the part worth explaining: an item with no price
 * cannot be bought, and an unbuyable row in a shop is a dead end that
 * makes the shop look broken. The owner is told why it is missing, in the
 * admin, against the item. See lib/surfaces.ts.
 */
export async function getShopItems(): Promise<ItemRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("items")
    .select("*")
    .neq("status", "hidden")
    .not("category", "in", FIREARM_LIST)
    .not("price_cents", "is", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("getShopItems", error);
    return [];
  }
  return data;
}

/**
 * Sizes for one item, in the order the owner entered them.
 *
 * Sold-out sizes come back too. A large that has gone is information the
 * customer wants — hiding it just makes them wonder whether it was ever
 * stocked.
 */
export async function getItemVariants(itemId: string): Promise<VariantOption[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("item_variants")
    .select("id, size, stock")
    .eq("item_id", itemId)
    .order("sort_order", { ascending: true });
  if (error) {
    logDbError("getItemVariants", error);
    return [];
  }
  return (data ?? []).map((v) => ({ id: v.id, size: v.size, inStock: v.stock > 0 }));
}

/** Which of these items have every size sold out, for the grid's overlay. */
export async function getSoldOutItemIds(itemIds: string[]): Promise<Set<string>> {
  const sb = getSupabase();
  if (!sb || itemIds.length === 0) return new Set();
  const { data, error } = await sb
    .from("item_variants")
    .select("item_id, stock")
    .in("item_id", itemIds);
  if (error) {
    logDbError("getSoldOutItemIds", error);
    return new Set();
  }
  const total = new Map<string, number>();
  for (const row of data ?? []) {
    total.set(row.item_id, (total.get(row.item_id) ?? 0) + row.stock);
  }
  return new Set([...total.entries()].filter(([, n]) => n <= 0).map(([id]) => id));
}

/**
 * The newest things a customer can actually buy.
 *
 * Purchasable only — not a firearm, and priced. The home page is a taste
 * of the shop, and a taste that leads to "call for price" is a worse
 * first impression than showing one fewer item. Ordered by when the row
 * was created, which is the only honest reading of "newest": sort_order
 * is the owner's arrangement, not an arrival time.
 */
export async function getFreshArrivals(limit = 2): Promise<ItemRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("items")
    .select("*")
    .neq("status", "hidden")
    .not("category", "in", FIREARM_LIST)
    .not("price_cents", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logDbError("getFreshArrivals", error);
    return [];
  }
  return data;
}

export async function getItemBySlug(slug: string): Promise<ItemRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("items")
    .select("*")
    .eq("slug", slug)
    .neq("status", "hidden")
    .maybeSingle();
  if (error) {
    logDbError("getItemBySlug", error);
    return null;
  }
  return data;
}

export async function getRelatedItems(
  category: string,
  excludeSlug: string,
  limit = 3,
): Promise<ItemRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("items")
    .select("*")
    .eq("category", category)
    .neq("slug", excludeSlug)
    .neq("status", "hidden")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logDbError("getRelatedItems", error);
    return [];
  }
  return data;
}

export function itemImages(item: ItemRow): string[] {
  return Array.isArray(item.images)
    ? item.images.filter((u): u is string => typeof u === "string")
    : [];
}

export function itemStatus(item: ItemRow): ItemStatus {
  return item.status === "reserved" || item.status === "sold"
    ? item.status
    : "available";
}

export function itemSpecs(item: ItemRow): [string, string][] {
  if (!item.specs || typeof item.specs !== "object" || Array.isArray(item.specs))
    return [];
  return Object.entries(item.specs).flatMap(([k, v]) =>
    typeof v === "string" || typeof v === "number" ? [[k, String(v)] as [string, string]] : [],
  );
}

export function toIndexItem(item: ItemRow): IndexItem {
  return {
    slug: item.slug,
    name: item.name,
    category: item.category.toUpperCase(),
    categoryKey: item.category,
    status: itemStatus(item),
    image: itemImages(item)[0],
  };
}
