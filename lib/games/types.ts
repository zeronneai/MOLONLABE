// A game and its spots, as the rest of the app needs them.

export type GameStatus = "open" | "full" | "drawn";

export type SpotStatus = "open" | "held" | "sold";

export type Game = {
  id: string;
  title: string;
  description: string | null;
  itemId: string | null;
  totalSpots: number;
  spotPriceCents: number;
  status: GameStatus;
  winnerNote: string | null;
};

/**
 * One cell of the public board.
 *
 * `displayName` is non-null only where the buyer ticked the opt-in, and
 * even then it is first name plus last initial. There is no shape of this
 * type that can carry an email address — that is the point of reading it
 * through a view rather than filtering the table in application code.
 */
export type BoardSpot = {
  spotNumber: number;
  status: SpotStatus;
  displayName: string | null;
};

/** The scoreboard: the two numbers, and nothing derived from guesswork. */
export type SpotCounts = {
  total: number;
  remaining: number;
  sold: number;
};

/**
 * A game is buyable only while it is open and has spots left. Both
 * conditions, because the two can disagree for a moment: the status flips
 * to `full` inside the same statement that sells the last spot, and a
 * page rendered a beat earlier will have the older one.
 */
export function isBuyable(game: Game, counts: SpotCounts): boolean {
  return game.status === "open" && counts.remaining > 0;
}

/** How many spots one person may take in a single transaction. */
export const MAX_SPOTS_PER_ORDER = 25;
