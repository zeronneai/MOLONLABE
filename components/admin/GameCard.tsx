"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { formatUsd } from "@/lib/money";
import type { GameRow } from "@/lib/database.types";
import { useIsOwner } from "@/components/admin/Role";
import { OWNER_ONLY } from "@/lib/admin/constants";
import InStoreSaleDialog from "@/components/admin/InStoreSaleDialog";
import type { DropAfterSale } from "@/components/admin/InStoreSaleForm";

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
  sold: soldAtLoad,
  available: availableAtLoad,
}: {
  game: GameRow;
  itemName?: string;
  sold: number;
  /** Guides the website can still sell, as the public page counts them. */
  available: number;
}) {
  const owner = useIsOwner();
  // Updated from each sale's result, so the row is right the moment the
  // popup says so, without reloading the list.
  const [sold, setSold] = useState(soldAtLoad);
  const [available, setAvailable] = useState(availableAtLoad);
  const [status, setStatus] = useState(game.status);
  const [selling, setSelling] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pct = game.total_spots > 0 ? (sold / game.total_spots) * 100 : 0;

  const recorded = useCallback((drop: DropAfterSale) => {
    setSold(drop.sold);
    setAvailable(drop.remaining);
    setStatus(drop.status);
  }, []);
  const close = useCallback(() => {
    setSelling(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  return (
    <div className="border-b hairline py-5" data-drop-row={game.id}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="display truncate text-lg">{game.title.toUpperCase()}</p>
          <p className="label mt-1 text-muted">
            {itemName ?? "No featured piece set"} · {formatUsd(game.spot_price_cents)} a guide
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="display text-2xl tabular-nums">
            <span data-drop-sold>{sold}</span>
            <span className="text-muted">/{game.total_spots}</span>
          </p>
          <p className={`label ${TONE[status] ?? "text-muted"}`} data-drop-status>
            {status}
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
          {status === "open" && (
            <>
              <span data-drop-remaining className="text-acid">{available}</span> left ·{" "}
            </>
          )}
          {formatUsd(sold * game.spot_price_cents)} taken
        </span>
        <div className="ml-auto flex items-center gap-2">
          {owner ? (
            <a
              href={`/admin/games/${game.id}/guides.csv`}
              className="label flex h-11 items-center px-3 text-muted hover:text-bone"
            >
              CSV
            </a>
          ) : (
            <span
              aria-disabled="true"
              title={OWNER_ONLY}
              className="label flex h-11 cursor-not-allowed items-center px-3 text-muted opacity-50"
            >
              CSV · owner only
            </span>
          )}
          <Link href={`/admin/games/${game.id}`} className="control control-sm">
            Open
          </Link>
          {/* Open drops only. The list is where staff start at the
              counter, so the sale is one tap from here. */}
          {status === "open" && (
            <button
              ref={trigger}
              type="button"
              onClick={() => setSelling(true)}
              className="control control-sm control-go"
              data-record-in-store
            >
              Record in-store sale
            </button>
          )}
        </div>
      </div>

      {selling && (
        <InStoreSaleDialog
          gameId={game.id}
          gameTitle={game.title}
          available={available}
          onRecorded={recorded}
          onClose={close}
        />
      )}
    </div>
  );
}
