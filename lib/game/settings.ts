// Server-side game settings: difficulty and the reward offer, read from
// the key/value settings table with config.ts as fallback. The offer row
// is RLS-gated so the anon key cannot read it (or the code inside it)
// while disabled — when it's off, the code never reaches the server
// payload, the DOM, or the wire.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabase } from "@/lib/supabase/server";
import { DESKTOP_TUNING, MOBILE_TUNING, type Tuning } from "./config";

export type GameOffer =
  | { enabled: true; code: string; value: string; expires: string | null; note: string }
  | { enabled: false };

export interface GameSettings {
  difficulty: { desktop: Tuning; mobile: Tuning };
  offer: GameOffer;
}

// Owner-tunable ranges — shared by the admin form and the site reader so
// a bad stored value can never break the game.
export const DIFFICULTY_RANGES = {
  roundMs: { min: 5_000, max: 20_000 },
  targetCount: { min: 3, max: 15 },
  popMs: { min: 300, max: 2_000 },
  magSize: { min: 2, max: 12 },
} as const;

export function clampDifficulty(raw: unknown, base: Tuning): Tuning {
  const source = (raw ?? {}) as Record<string, unknown>;
  const num = (key: keyof typeof DIFFICULTY_RANGES, fallback: number) => {
    const value = Number(source[key]);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(DIFFICULTY_RANGES[key].max, Math.max(DIFFICULTY_RANGES[key].min, Math.round(value)));
  };
  const popMs = num("popMs", (base.popMinMs + base.popMaxMs) / 2);
  return {
    ...base,
    roundMs: num("roundMs", base.roundMs),
    targetCount: num("targetCount", base.targetCount),
    magSize: num("magSize", base.magSize),
    popMinMs: Math.round(popMs * 0.8),
    popMaxMs: Math.round(popMs * 1.2),
  };
}

function parseOffer(raw: unknown): GameOffer {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { enabled: false };
  const value = raw as Record<string, unknown>;
  const code = typeof value.code === "string" ? value.code.trim() : "";
  if (value.enabled !== true || !code) return { enabled: false };
  return {
    enabled: true,
    code,
    value: typeof value.value === "string" ? value.value : "",
    expires: typeof value.expires === "string" && value.expires ? value.expires : null,
    note: typeof value.note === "string" ? value.note : "",
  };
}

export async function getGameSettings(): Promise<GameSettings> {
  noStore(); // the kill switch must take effect on the next request, everywhere
  const fallback: GameSettings = {
    difficulty: { desktop: DESKTOP_TUNING, mobile: MOBILE_TUNING },
    offer: { enabled: false },
  };
  const sb = getSupabase();
  if (!sb) return fallback;

  const { data, error } = await sb
    .from("settings")
    .select("key, value")
    .in("key", ["game_difficulty", "game_offer"]);
  if (error || !data) return fallback;

  const byKey = new Map(data.map((row) => [row.key, row.value]));
  const difficultyRaw = (byKey.get("game_difficulty") ?? {}) as Record<string, unknown>;

  return {
    difficulty: {
      desktop: clampDifficulty(difficultyRaw.desktop, DESKTOP_TUNING),
      mobile: clampDifficulty(difficultyRaw.mobile, MOBILE_TUNING),
    },
    offer: parseOffer(byKey.get("game_offer")),
  };
}
