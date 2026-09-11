"use client";

// The draw. One ticket per sold spot, so somebody holding five spots has
// five chances and the winning ticket number is the winning spot number.
// Irreversible in practice, so it sits behind a confirmation that names
// the game and states the pool size.

import { useState, useTransition } from "react";
import { drawWinner } from "@/app/admin/actions";

export default function DrawPanel({
  gameId,
  gameTitle,
  spotsSold,
  totalSpots,
  buyers,
  winnerName,
  winningSpot,
}: {
  gameId: string;
  gameTitle: string;
  spotsSold: number;
  totalSpots: number;
  buyers: number;
  winnerName: string | null;
  winningSpot: number | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (winnerName) {
    return (
      <section className="mt-20 border-t hairline pt-10">
        <h2 className="label text-acid">Winner drawn</h2>
        <p className="display mt-4 text-2xl">{winnerName.toUpperCase()}</p>
        <p className="mt-3 max-w-[56ch] text-sm text-muted">
          {winningSpot ? `Spot ${winningSpot}, drawn from ` : "Drawn from "}
          {spotsSold} {spotsSold === 1 ? "spot" : "spots"} across {buyers}{" "}
          {buyers === 1 ? "buyer" : "buyers"}. They appear under past
          winners on the featured page.
        </p>
        <a href={`/draw/${gameId}`} className="control mt-6">
          Open presentation
        </a>
      </section>
    );
  }

  return (
    <section className="mt-20 border-t hairline pt-10">
      <h2 className="label text-amber">Draw a winner</h2>
      <p className="mt-3 max-w-[56ch] text-sm text-muted">
        Picks one spot at random from the {spotsSold}{" "}
        {spotsSold === 1 ? "spot" : "spots"} sold, held by {buyers}{" "}
        {buyers === 1 ? "buyer" : "buyers"}. Somebody holding five spots
        has five chances. This can only be done once.
        {spotsSold < totalSpots && (
          <>
            {" "}
            <span className="text-amber">
              {totalSpots - spotsSold} of {totalSpots} spots are still
              unsold — drawing now draws from the {spotsSold} sold.
            </span>
          </>
        )}
      </p>

      {/* Presentation mode is the intended route: it runs the same
          commit, then reveals it. This plain button stays as the fallback
          for a draw nobody is filming. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`/draw/${gameId}`}
          className="control control-caution"
          aria-disabled={spotsSold === 0}
        >
          Presentation mode
        </a>
        <button
          type="button"
          disabled={spotsSold === 0 || pending}
          onClick={() => setConfirming(true)}
          className="control"
        >
          {spotsSold === 0 ? "No spots sold yet" : "Draw without ceremony"}
        </button>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm draw"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 p-5 sm:items-center"
        >
          <div className="w-full max-w-md border hairline bg-surface p-6">
            <p className="display text-xl">
              Draw the winner for {gameTitle.toUpperCase()}?
            </p>
            <p className="mt-3 text-sm text-muted">
              One spot is picked from the {spotsSold} sold. The game is
              marked drawn and cannot be drawn again.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await drawWinner(gameId);
                    setConfirming(false);
                  })
                }
                className="control control-caution flex-1"
              >
                {pending ? "Drawing…" : "Draw"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="control flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
