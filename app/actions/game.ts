"use server";

// Game telemetry — the only way we ever learn whether the game works.
// Fire-and-forget: never blocks or breaks the game.

import { getServiceSupabase } from "@/lib/supabase/service";
import { getSupabase } from "@/lib/supabase/server";

const KINDS = new Set(["played", "won", "code_copied"]);
const MODES = new Set(["desktop", "mobile"]);

export async function recordGameEvent(kind: string, mode: string): Promise<void> {
  if (!KINDS.has(kind) || !MODES.has(mode)) return;
  const sb = getServiceSupabase() ?? getSupabase();
  if (!sb) return;
  const { error } = await sb.from("game_events").insert({ kind, mode });
  if (error) console.error("recordGameEvent:", error.message);
}
