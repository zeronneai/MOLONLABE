import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import type { GameRow, ItemRow } from "@/lib/database.types";
import type { BoardSpot, Game, SpotCounts } from "./types";

export type GameWithItem = GameRow & { item: ItemRow | null };

export function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    itemId: row.item_id,
    totalSpots: row.total_spots,
    spotPriceCents: row.spot_price_cents,
    status: row.status as Game["status"],
    winnerNote: row.winner_note,
  };
}

/**
 * The game on the front of the site.
 *
 * An open game wins over a full one, and the newest wins within that, so
 * a game awaiting its draw keeps the slot until something is actually on
 * sale again — a blank page between two games would be worse than showing
 * the one everyone is waiting on.
 */
export async function getCurrentGame(): Promise<GameWithItem | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("games")
    .select("*, item:items(*)")
    .in("status", ["open", "full"])
    .order("status", { ascending: true }) // 'full' < 'open' alphabetically
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    logDbError("getCurrentGame", error);
    return null;
  }
  const rows = (data ?? []) as GameWithItem[];
  return rows.find((g) => g.status === "open") ?? rows[0] ?? null;
}

export async function getGameById(id: string): Promise<GameWithItem | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("games")
    .select("*, item:items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logDbError("getGameById", error);
    return null;
  }
  return (data as GameWithItem) ?? null;
}

/**
 * The scoreboard.
 *
 * Counted rather than stored. A denormalised counter is one more thing
 * that can disagree with the rows that actually decide whether a sale can
 * happen, and the number on this page is the whole tension of the game.
 */
export async function getSpotCounts(
  gameId: string,
  totalSpots: number,
): Promise<SpotCounts> {
  const sb = getSupabase();
  if (!sb) return { total: totalSpots, remaining: 0, sold: totalSpots };
  const { data, error } = await sb.rpc("game_spots_remaining", {
    p_game: gameId,
  });
  if (error) {
    logDbError("getSpotCounts", error);
    // Zero remaining rather than "all available": refusing a sale that
    // could have happened is recoverable, overselling is not.
    return { total: totalSpots, remaining: 0, sold: totalSpots };
  }
  const remaining = Math.max(0, Math.min(totalSpots, data ?? 0));
  return { total: totalSpots, remaining, sold: totalSpots - remaining };
}

/**
 * Every spot, for the board.
 *
 * Read from the view, never the table. The view has no email column at
 * all, so no bug in this file or any component downstream of it can leak
 * one.
 */
export async function getBoard(gameId: string): Promise<BoardSpot[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("game_spot_board")
    .select("spot_number, status, display_name")
    .eq("game_id", gameId)
    .order("spot_number");
  if (error) {
    logDbError("getBoard", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    spotNumber: r.spot_number,
    // A held spot is mid-checkout and nobody else's business. It reads as
    // taken on the board, because to anyone else that is what it is.
    status: r.status === "held" ? "sold" : (r.status as BoardSpot["status"]),
    displayName: r.display_name,
  }));
}
