import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";
import type { GameRow, ItemRow } from "@/lib/database.types";
import { gameState } from "./types";
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

// ---------------------------------------------------------------------
// The Games surface
// ---------------------------------------------------------------------

export type GameSummary = {
  id: string;
  title: string;
  status: Game["status"];
  totalSpots: number;
  spotPriceCents: number;
  /**
   * Spots sold. For a drawn game this is the number frozen at the draw,
   * not a live recount — see the 20260923 migration for why.
   */
  sold: number;
  /** True when `sold` is the frozen number rather than a live count. */
  soldFrozen: boolean;
  /**
   * What a recount says right now. Equal to `sold` unless a drawn game's
   * spots changed after the draw — a refund, a correction.
   *
   * Nothing renders it yet. It is carried because the difference between
   * these two numbers is the only evidence that a finished game was
   * touched afterwards, and losing that is how the frozen count would
   * become unfalsifiable rather than merely stable.
   */
  soldNow: number;
  item: ItemRow | null;
  /** Set once drawn. First name plus last initial, never more. */
  winnerName: string | null;
  drawnAt: string | null;
  drawnEarly: boolean;
  unsoldAtDraw: number | null;
  createdAt: string | null;
};

/**
 * Every game with its sold count, newest first, in its three states.
 *
 * One query per table rather than per game: a games page with twenty
 * games would otherwise make forty-one round trips, and the counts are
 * cheap to group in memory.
 *
 * Three groups rather than live-and-done. A game that has sold out but
 * not yet been drawn is neither: putting it under "Open now" wastes the
 * visit of someone who came to buy, and hiding it throws away the best
 * evidence on the site that these games fill. See `gameState`.
 */
export async function getAllGames(): Promise<{
  open: GameSummary[];
  awaiting: GameSummary[];
  finished: GameSummary[];
}> {
  const empty = { open: [], awaiting: [], finished: [] };
  const sb = getSupabase();
  if (!sb) return empty;

  // The counts come from game_scoreboard, never from game_spots.
  //
  // game_spots is readable only by an authenticated role — it holds
  // buyer names and emails — and this function runs on public pages
  // with the anonymous key. Row level security answers that select with
  // an EMPTY SET rather than an error, so counting from the table here
  // succeeded, returned nothing, and rendered every game as "0 / N".
  // The view is granted to anon and exposes a count and nothing else.
  const [{ data: games, error }, { data: board }, { data: winners }] =
    await Promise.all([
      sb.from("games").select("*, item:items(*)").order("created_at", { ascending: false }),
      sb.from("game_scoreboard").select("game_id, sold, frozen, sold_now"),
      sb
        .from("winners")
        .select("game_id, display_name, drawn_at, drawn_early, unsold_spots"),
    ]);
  if (error) {
    logDbError("getAllGames", error);
    return empty;
  }

  const scoreBy = new Map(
    (board ?? []).map((r) => [r.game_id, r] as const),
  );
  const winnerBy = new Map(
    (winners ?? []).map((w) => [w.game_id, w] as const),
  );

  const all: GameSummary[] = ((games ?? []) as GameWithItem[]).map((g) => {
    const w = winnerBy.get(g.id);
    const score = scoreBy.get(g.id);
    return {
      id: g.id,
      title: g.title,
      status: g.status as Game["status"],
      totalSpots: g.total_spots,
      spotPriceCents: g.spot_price_cents,
      sold: score?.sold ?? 0,
      soldFrozen: score?.frozen ?? false,
      soldNow: score?.sold_now ?? score?.sold ?? 0,
      item: g.item,
      winnerName: w?.display_name ?? null,
      drawnAt: w?.drawn_at ?? null,
      drawnEarly: w?.drawn_early ?? false,
      unsoldAtDraw: w?.unsold_spots ?? null,
      createdAt: g.created_at,
    };
  });

  return {
    open: all.filter((g) => gameState(g) === "open"),
    awaiting: all.filter((g) => gameState(g) === "awaiting"),
    finished: all.filter((g) => gameState(g) === "finished"),
  };
}

/**
 * Item ids currently attached to a game, so the case can exclude them.
 *
 * Includes drawn games. A rifle that was given away stays on the Games
 * surface as history rather than reappearing in the case, which is the
 * client's instruction — and is also true: it has an owner now.
 */
export async function getGameItemIds(): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("games")
    .select("item_id")
    .not("item_id", "is", null);
  if (error) {
    logDbError("getGameItemIds", error);
    return [];
  }
  return (data ?? []).map((r) => r.item_id).filter((id): id is string => Boolean(id));
}
