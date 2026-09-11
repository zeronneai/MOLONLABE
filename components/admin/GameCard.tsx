"use client";

import Link from "next/link";
import { formatUsd } from "@/lib/money";
import type { GameRow } from "@/lib/database.types";

// No status buttons. A game's state is derived — open at creation, full
// the instant the last spot sells, drawn once a winner is recorded — so
// there is nothing here for a person to set, and offering a control that
// could contradict the spot rows would be worse than offering none.
const TONE: Record<string, string> = {
  open: "text-acid",
  full: "text-amber",
  drawn: "text-muted",
};

export default function GameCard({
  game,
  itemName,
  sold,
}: {
  game: GameRow;
  itemName?: string;
  sold: number;
}) {
  const pct = game.total_spots > 0 ? (sold / game.total_spots) * 100 : 0;

  return (
    <div className="border-b hairline py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="display truncate text-lg">{game.title.toUpperCase()}</p>
          <p className="label mt-1 text-muted">
            {itemName ?? "No prize set"} · {formatUsd(game.spot_price_cents)} a spot
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="display text-2xl tabular-nums">
            {sold}
            <span className="text-muted">/{game.total_spots}</span>
          </p>
          <p className={`label ${TONE[game.status] ?? "text-muted"}`}>
            {game.status}
          </p>
        </div>
      </div>

      {/* The fill, as a bar. The number above is the fact; this is how
          fast it is moving, which is what the owner actually watches. */}
      <div className="mt-4 h-1 w-full bg-surface-sunken">
        <div
          className="h-1 bg-acid"
          style={{ width: `${Math.min(100, pct)}%` }}
          role="presentation"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="label text-muted">
          {formatUsd(sold * game.spot_price_cents)} taken
        </span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/admin/games/${game.id}/spots.csv`}
            className="label flex h-11 items-center px-3 text-muted hover:text-bone"
          >
            CSV
          </a>
          <Link href={`/admin/games/${game.id}`} className="control control-sm">
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}
