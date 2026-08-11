import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import type { ItemRow, ItemStatus } from "@/lib/database.types";
import type { IndexItem } from "@/components/inventory/EditorialIndex";

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

export async function getFreshArrivals(limit = 6): Promise<ItemRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("items")
    .select("*")
    .neq("status", "hidden")
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
