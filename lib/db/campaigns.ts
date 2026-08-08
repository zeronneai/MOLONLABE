import { getSupabase } from "@/lib/supabase/server";
import type { CampaignRow, ItemRow } from "@/lib/database.types";

export type LiveCampaign = CampaignRow & { item: ItemRow | null };

export async function getLiveCampaign(): Promise<LiveCampaign | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("campaigns")
    .select("*, item:items(*)")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getLiveCampaign:", error.message);
    return null;
  }
  return data as LiveCampaign | null;
}

export async function getEntryCount(campaignId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc("entry_count", { campaign: campaignId });
  if (error) {
    console.error("getEntryCount:", error.message);
    return 0;
  }
  return data ?? 0;
}
