import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { logDbError } from "@/lib/db/log";

/**
 * Who did it, as a name.
 *
 * Never an email address, and never a name the person typed about
 * themselves: it comes from the staff table (lib/admin/staff.ts), which
 * only the owner can write to, and the database stamps the same name on
 * every log line itself so a request cannot sign as somebody else.
 */
export type Actor = { user: User; name: string };

export type ActivityAction =
  | "create"
  | "update"
  | "archive"
  | "restore"
  | "delete"
  | "status"
  | "price"
  | "featured"
  | "offer"
  | "difficulty"
  | "commerce"
  | "draw"
  | "stock"
  | "photos"
  | "alerts";

export type ActivityEntry = {
  action: ActivityAction;
  entity: "item" | "game" | "settings" | "inquiry";
  entityId?: string | null;
  /** Name or title as it was, so a deleted record stays identifiable. */
  entityLabel?: string | null;
  field?: string | null;
  before?: Json;
  after?: Json;
};

/**
 * Records one admin action.
 *
 * Deliberately never throws and never blocks the caller: a log that can
 * fail a price change is worse than a gap in the log. Failures go to the
 * server console.
 *
 * `before` is the reason this table exists. Knowing a price changed is
 * far less useful than knowing what it changed from.
 */
export async function logActivity(
  sb: SupabaseClient<Database>,
  actor: Actor,
  entry: ActivityEntry,
): Promise<void> {
  // Both of these are overwritten by the database from the session. They
  // are sent so the column constraints are met and so the test double,
  // which has no triggers, records the same thing.
  const { error } = await sb.from("admin_activity").insert({
    actor_id: actor.user.id,
    actor_name: actor.name,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    entity_label: entry.entityLabel ?? null,
    field: entry.field ?? null,
    before_value: entry.before ?? null,
    after_value: entry.after ?? null,
  });
  if (error) logDbError("logActivity", error);
}

/**
 * The fields worth logging a before/after for on an item edit.
 *
 * Not every field: an edit that fixes a typo in a description should not
 * produce six log lines. These are the ones with consequences — money,
 * availability, and whether a thing can be put in the post.
 */
export const WATCHED_ITEM_FIELDS = [
  "price_cents",
  "status",
  "fulfillment_type",
  "shipping_tier",
  "shipping_override_cents",
  "is_featured",
] as const;

export function changedFields<T extends Record<string, unknown>>(
  before: T | null,
  after: T,
  fields: readonly string[],
): { field: string; before: Json; after: Json }[] {
  if (!before) return [];
  const out: { field: string; before: Json; after: Json }[] = [];
  for (const field of fields) {
    const was = before[field] ?? null;
    const now = after[field] ?? null;
    if (was !== now) out.push({ field, before: was as Json, after: now as Json });
  }
  return out;
}
