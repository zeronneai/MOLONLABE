import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import type { WinnerRow } from "@/lib/database.types";

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
