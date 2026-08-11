// Game telemetry aggregates for the admin. Session client only — RLS
// restricts game_events reads to the owner.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface WindowStats {
  played: number;
  won: number;
  copied: number;
  winRate: number | null; // null until anyone has played
}

export interface GameStats {
  last7: WindowStats;
  allTime: WindowStats;
  byMode7: { desktop: number | null; mobile: number | null }; // win rates
}

async function countEvents(
  sb: SupabaseClient<Database>,
  kind: string,
  opts: { mode?: string; since?: string } = {},
): Promise<number> {
  let query = sb
    .from("game_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind);
  if (opts.mode) query = query.eq("mode", opts.mode);
  if (opts.since) query = query.gte("created_at", opts.since);
  const { count, error } = await query;
  if (error) {
    console.error("countEvents:", error.message);
    return 0;
  }
  return count ?? 0;
}

const rate = (won: number, played: number) => (played > 0 ? won / played : null);

export async function getGameStats(sb: SupabaseClient<Database>): Promise<GameStats> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [
    played7,
    won7,
    copied7,
    playedAll,
    wonAll,
    copiedAll,
    playedDesktop7,
    wonDesktop7,
    playedMobile7,
    wonMobile7,
  ] = await Promise.all([
    countEvents(sb, "played", { since }),
    countEvents(sb, "won", { since }),
    countEvents(sb, "code_copied", { since }),
    countEvents(sb, "played"),
    countEvents(sb, "won"),
    countEvents(sb, "code_copied"),
    countEvents(sb, "played", { since, mode: "desktop" }),
    countEvents(sb, "won", { since, mode: "desktop" }),
    countEvents(sb, "played", { since, mode: "mobile" }),
    countEvents(sb, "won", { since, mode: "mobile" }),
  ]);

  return {
    last7: { played: played7, won: won7, copied: copied7, winRate: rate(won7, played7) },
    allTime: {
      played: playedAll,
      won: wonAll,
      copied: copiedAll,
      winRate: rate(wonAll, playedAll),
    },
    byMode7: {
      desktop: rate(wonDesktop7, playedDesktop7),
      mobile: rate(wonMobile7, playedMobile7),
    },
  };
}
