// The board.
//
// Every spot in the game, in order, so the filling is something you can
// watch rather than a number you have to trust. A sold spot is anonymous
// unless its buyer ticked the opt-in at checkout; most will not have, and
// a board of mostly-anonymous taken spots is the expected look, not a
// failure of the feature.
//
// Server-rendered from a view that has no email column on it at all.

import type { BoardSpot } from "@/lib/games/types";

export default function SpotBoard({
  spots,
  total,
}: {
  spots: BoardSpot[];
  total: number;
}) {
  if (spots.length === 0) return null;

  return (
    <section aria-labelledby="board-heading" className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="board-heading" className="label text-muted">
          The board
        </h2>
        <p className="label text-muted">
          {spots.filter((s) => s.status === "open").length} open ·{" "}
          {spots.filter((s) => s.status !== "open").length} taken
        </p>
      </div>

      {/* A fixed cell size rather than a fluid grid: the board should
          look the same shape on a phone as on a laptop, just narrower,
          because the pattern of what is gone is the information. */}
      <ul
        className="mt-6 grid gap-px border hairline bg-[var(--color-rule,#2a2c30)]"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
        }}
      >
        {spots.map((spot) => {
          const taken = spot.status !== "open";
          return (
            <li
              key={spot.spotNumber}
              className={`flex min-h-[72px] flex-col items-center justify-center gap-1 p-2 text-center ${
                taken ? "bg-surface-sunken" : "bg-surface"
              }`}
            >
              <span
                className={`text-[13px] font-extrabold tabular-nums tracking-[-0.02em] ${
                  taken ? "text-muted" : "text-bone"
                }`}
              >
                {spot.spotNumber}
              </span>
              {taken && (
                <span
                  className={`block max-w-full truncate text-[10px] uppercase leading-tight tracking-[0.12em] ${
                    spot.displayName ? "text-acid" : "text-muted"
                  }`}
                >
                  {/* No name is the default and reads as a state, not as
                      missing data. */}
                  {spot.displayName ?? "Taken"}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="label mt-5 max-w-[60ch] text-muted">
        Names appear only where the buyer asked for them. Everyone else
        shows as taken — that is the default, and it is what most people
        leave it on. Nothing here is ever more than a first name and an
        initial.
      </p>
      <p className="sr-only">
        {spots.filter((s) => s.status === "open").length} of {total} spots
        remain.
      </p>
    </section>
  );
}
