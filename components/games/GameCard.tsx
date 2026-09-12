import Link from "next/link";
import Image from "next/image";
import { formatUsd } from "@/lib/money";
import { itemImages } from "@/lib/db/items";
import type { GameSummary } from "@/lib/games/queries";
import { demoStrippedTitle, isDemoGame } from "@/lib/surfaces";

const stamp = (iso: string | null) => {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(at);
};

/**
 * One game, live or finished.
 *
 * The count is the loudest thing on the card. It is the whole tension of
 * a fixed-pool game — "31 of 100 gone" tells a visitor more about whether
 * to act than any sentence we could write — so it is set in the display
 * face rather than tucked into a caption.
 */
export default function GameCard({
  game,
  finished = false,
}: {
  game: GameSummary;
  finished?: boolean;
}) {
  const image = game.item ? itemImages(game.item)[0] ?? null : null;
  const remaining = Math.max(0, game.totalSpots - game.sold);
  const pct = game.totalSpots > 0 ? (game.sold / game.totalSpots) * 100 : 0;
  const drawnOn = stamp(game.drawnAt);
  const demo = isDemoGame(game.title);

  return (
    <article className="border hairline bg-surface">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        {/* Unmissable on purpose. A demo game that reads as real is worse
            than no demo at all. */}
        {demo && (
          <p className="absolute left-0 top-0 z-10 bg-amber px-3 py-1 text-xs font-bold uppercase tracking-[0.28em] text-ink">
            Demo — not a real game
          </p>
        )}
        {image ? (
          <Image
            src={image}
            alt={game.item?.name ?? game.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={`object-cover ${finished ? "opacity-60 grayscale" : ""}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="label text-muted">No photograph yet</span>
          </div>
        )}
      </div>

      <div className="p-6">
        <p className={`label ${finished ? "text-muted" : "text-acid"}`}>
          {finished ? `Drawn${drawnOn ? ` ${drawnOn}` : ""}` : "Open now"}
        </p>
        <h3 className="display mt-3 text-xl">
          {demoStrippedTitle(game.title).toUpperCase()}
        </h3>
        {game.item && (
          <p className="mt-2 text-sm text-muted">{game.item.name}</p>
        )}

        {/* The scoreboard. Sold out of total, always both numbers — a
            percentage alone hides whether the pool is ten or a thousand. */}
        <p className="display mt-5 text-3xl">
          {game.sold}
          <span className="text-muted"> / {game.totalSpots}</span>
        </p>
        <p className="label mt-1 text-muted">
          {finished
            ? `${game.sold} ${game.sold === 1 ? "spot" : "spots"} sold`
            : remaining === 0
              ? "Sold out — drawing soon"
              : `${remaining} left`}
        </p>

        {!finished && (
          <div
            className="mt-4 h-[2px] w-full bg-surface-sunken"
            role="img"
            aria-label={`${game.sold} of ${game.totalSpots} spots sold`}
          >
            <div className="h-full bg-acid" style={{ width: `${pct}%` }} />
          </div>
        )}

        {finished ? (
          <>
            {game.winnerName && (
              <p className="mt-5 text-sm">
                <span className="text-muted">Won by </span>
                <strong>{game.winnerName}</strong>
              </p>
            )}
            {/* Said plainly rather than buried. A game drawn short is a
                departure from the terms buyers accepted, and someone
                reading the history is entitled to see which ones were. */}
            {game.drawnEarly && game.unsoldAtDraw ? (
              <p className="label mt-2 text-amber">
                Drawn with {game.unsoldAtDraw} unsold
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-5 text-sm text-muted">
              {formatUsd(game.spotPriceCents)} a spot
            </p>
            <Link href="/featured" className="control mt-5 w-full justify-center">
              {remaining === 0 ? "See the board" : "Take a spot"}
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
