import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logDbError } from "@/lib/db/log";

/**
 * Who gets which alert.
 *
 * Two groups, because two kinds of message go out and they matter to
 * different people:
 *
 *   problems  every `order_error`: a card charged and not recorded, an
 *             order saved without its lines, spots paid for and not
 *             sold, a guide that failed. Somebody has to act.
 *   routine   everything else: new orders, inquiries and transfer
 *             requests, a game selling out.
 *
 * Stored in `settings` under `alert_routing`, which only the owner can
 * write (the database refuses a manager). An empty list means "whoever
 * the script sends to by default", which is exactly how every alert was
 * delivered before this existed, so nothing changes until somebody puts
 * an address in.
 *
 * The Apps Script chooses the actual recipient. The site sends the list
 * as `notify_to` and a script that has not been updated ignores it. See
 * docs/email.md, "Who receives an alert".
 */
export type AlertGroup = "problems" | "routine";
export type AlertRouting = Record<AlertGroup, string[]>;

export const ALERT_ROUTING_KEY = "alert_routing";
export const MAX_RECIPIENTS = 10;

export const EMPTY_ROUTING: AlertRouting = { problems: [], routine: [] };

/** Deliberately loose. The job is catching a typo, not validating RFC 5322. */
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Addresses from free text: commas, semicolons, spaces or new lines. */
export function parseRecipients(
  raw: string,
): { ok: true; list: string[] } | { ok: false; bad: string } {
  const list: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const address = part.trim().toLowerCase();
    if (!address) continue;
    if (!EMAIL.test(address)) return { ok: false, bad: part.trim() };
    if (!list.includes(address)) list.push(address);
  }
  return { ok: true, list };
}

export function readRouting(value: unknown): AlertRouting {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && EMAIL.test(x)) : [];
  return { problems: list(raw.problems), routine: list(raw.routine) };
}

/**
 * The current routing, or empty if it cannot be read.
 *
 * Never throws and never blocks an alert: failing to read who should
 * get a message must not stop the message. The fallback is the script's
 * default recipient, which is today's behaviour.
 */
export async function loadRouting(
  sb: SupabaseClient<Database> | null,
): Promise<AlertRouting> {
  if (!sb) return EMPTY_ROUTING;
  const { data, error } = await sb
    .from("settings")
    .select("value")
    .eq("key", ALERT_ROUTING_KEY)
    .maybeSingle();
  if (error) {
    logDbError("loadRouting", error);
    return EMPTY_ROUTING;
  }
  return readRouting(data?.value);
}
