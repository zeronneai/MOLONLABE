import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface ItemReferences {
  inquiries: number;
  campaigns: number;
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
  const [inquiries, campaigns] = await Promise.all([
    sb.from("inquiries").select("id", { count: "exact", head: true }).eq("item_id", id),
    sb.from("campaigns").select("id", { count: "exact", head: true }).eq("item_id", id),
  ]);
  const i = inquiries.count ?? 0;
  const c = campaigns.count ?? 0;
  const parts: string[] = [];
  if (i > 0) parts.push(plural(i, "inquiry", "inquiries"));
  if (c > 0) parts.push(plural(c, "campaign", "campaigns"));
  return {
    inquiries: i,
    campaigns: c,
    total: i + c,
    label: parts.join(" and "),
  };
}
