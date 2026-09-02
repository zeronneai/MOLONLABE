import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface ItemReferences {
  inquiries: number;
  campaigns: number;
  orders: number;
  total: number;
  /** Human phrasing for the delete guard, e.g. "2 inquiries". */
  label: string;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * What still points at this item. Delete is only offered when this is
 * empty; the database enforces the same rule (both item_id foreign keys
 * are ON DELETE RESTRICT), but counting here lets the UI explain itself.
 */
export async function countItemReferences(
  sb: SupabaseClient<Database>,
  id: string,
): Promise<ItemReferences> {
  const [inquiries, campaigns, orders] = await Promise.all([
    sb.from("inquiries").select("id", { count: "exact", head: true }).eq("item_id", id),
    sb.from("campaigns").select("id", { count: "exact", head: true }).eq("item_id", id),
    sb.from("order_items").select("id", { count: "exact", head: true }).eq("item_id", id),
  ]);
  const i = inquiries.count ?? 0;
  const c = campaigns.count ?? 0;
  const o = orders.count ?? 0;
  const parts: string[] = [];
  if (i > 0) parts.push(plural(i, "inquiry", "inquiries"));
  if (c > 0) parts.push(plural(c, "campaign", "campaigns"));
  // An item that has been sold is part of the order record and can never
  // be deleted, only archived. The database enforces it too.
  if (o > 0) parts.push(plural(o, "order", "orders"));
  return {
    inquiries: i,
    campaigns: c,
    orders: o,
    total: i + c + o,
    label: parts.join(" and "),
  };
}
