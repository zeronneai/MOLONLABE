import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import type { WinnerRow } from "@/lib/database.types";

/** Total entries for a campaign, weighted by entry_count. */
export async function getEntryTotal(campaignId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc("entry_count", { campaign: campaignId });
  if (error) {
    logDbError("getEntryTotal", error);
    return 0;
  }
  return data ?? 0;
}

/** Distinct people entered, which is a different number from entries. */
export async function getEntrantTotal(campaignId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc("entrant_count", { campaign: campaignId });
  if (error) {
    logDbError("getEntrantTotal", error);
    return 0;
  }
  return data ?? 0;
}

export async function getWinners(limit = 8): Promise<WinnerRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("winners")
    .select("*")
    .order("drawn_at", { ascending: false })
    .limit(limit);
  if (error) {
    logDbError("getWinners", error);
    return [];
  }
  return data ?? [];
}
