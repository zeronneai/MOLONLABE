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

/**
 * The three states a game can be in, as a visitor experiences them.
 *
 * Not the same as `status`, and deliberately so. `status` has three
 * values too, but a game that has sold its last spot and not yet had the
 * status write land is `open` in the database and finished selling in
 * fact — and a listing that calls it "Open now" wastes the visit of
 * somebody who arrived ready to buy.
 *
 * So the count is consulted as well as the status, the same reasoning as
 * `isBuyable` above and for the same reason: the two can disagree for a
 * moment, and where they disagree the honest answer is the one that
 * refuses a sale rather than the one that offers a spot that is gone.
 *
 *   open      spots are available now
 *   awaiting  every spot is taken, the draw has not happened
 *   finished  drawn, with a winner
 *
 * `awaiting` is a real state rather than a flavour of open because
 * nothing can be bought in it. It stays visible — a pool that filled is
 * the best evidence there is that these games actually run — but it
 * carries no buy control at all.
 */
export type GameState = "open" | "awaiting" | "finished";

export function gameState(game: {
  status: GameStatus;
  sold: number;
  totalSpots: number;
}): GameState {
  if (game.status === "drawn") return "finished";
  if (game.status === "full" || game.sold >= game.totalSpots) return "awaiting";
  return "open";
}

// MAX_SPOTS_PER_ORDER lived here and is gone.
//
// It was 25, and nobody had ever decided that. I introduced it in the
// fixed-pool rebuild while building the quantity selector, with a
// one-line comment and no reason, and it then got written into the
// official rules as though it were policy.
//
// Nothing depended on it. The claim function takes `limit p_qty` with
// `for update skip locked` and has no bound of its own; the gateway is
// sent a total and no line items at all; `order_items.quantity` is a
// plain integer checked only for being positive. It cost the shop its
// best customer — the person who wants twenty spots — for nothing.
//
// The real bound is how many spots are left, which the pricer enforces
// against the database at checkout rather than trusting the browser.
