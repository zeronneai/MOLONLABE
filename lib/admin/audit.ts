import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { logDbError } from "@/lib/db/log";

/**
 * Who did it, as a name.
 *
 * Never an email address. Two people touch this admin — the agency and
 * the shop — and "who changed the price" is answered by a name, not by a
 * mailbox that then sits in a log, on a screen, and in a database that
 * gets exported.
 *
 * Supabase carries the name in user metadata, which is blank unless
 * somebody fills it in. The fallback identifies the account without
 * leaking anything: enough of the id to tell two people apart, and a
 * prompt to go and set a real name. See docs/admin-decisions.md.
 */
export function displayName(user: User | null): string {
  if (!user) return "Unknown";
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name", "display_name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `Unnamed (${user.id.slice(0, 6)})`;
}

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
  | "draw";

export type ActivityEntry = {
  action: ActivityAction;
  entity: "item" | "campaign" | "settings";
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
  user: User | null,
  entry: ActivityEntry,
): Promise<void> {
  const { error } = await sb.from("admin_activity").insert({
    actor_id: user?.id ?? null,
    actor_name: displayName(user),
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
