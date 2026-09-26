"use client";

// The draw. One entry per sold guide, so somebody holding five guides has
// five chances and the winning number is a guide number. Irreversible in
// practice, so it sits behind a confirmation that names the drop.
//
// Only once every guide is sold. There is no early draw: the rules say a
// drop runs until the last guide goes. Until then the draw controls are
// not rendered at all (presentation mode stays open, for rehearsal), and
// the server action and the database refuse it regardless.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { drawWinner } from "@/app/admin/actions";

export default function DrawPanel({
  gameId,
  gameTitle,
  spotsSold,
  totalSpots,
  buyers,
  unnamedBuyers,
  winnerName,
  winningSpot,
}: {
  gameId: string;
  gameTitle: string;
  spotsSold: number;
  totalSpots: number;
  buyers: number;
  /**
   * Buyers who have not agreed to be named on the broadcast, and so
   * appear on the roster by guide number. Null if it could not be read.
   */
  unnamedBuyers: number | null;
  winnerName: string | null;
  winningSpot: number | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  // A refusal has to land on screen. It used to go to the server log,
  // which meant the dialog closed and nothing visibly happened.
  const [refusal, setRefusal] = useState<string | null>(null);
  const router = useRouter();
  const soldOut = totalSpots > 0 && spotsSold >= totalSpots;

  if (winnerName) {
    return (
      <section className="mt-20 border-t hairline pt-10">
        <h2 className="label text-acid">Winner drawn</h2>
        <p className="display mt-4 text-2xl">{winnerName.toUpperCase()}</p>
        <p className="mt-3 max-w-[56ch] text-sm text-muted">
          {winningSpot ? `Guide #${winningSpot}, drawn from ` : "Drawn from "}
          {spotsSold} {spotsSold === 1 ? "guide" : "guides"} across {buyers}{" "}
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

      {refusal && (
        <div
          role="alert"
          className="mt-5 border-l-2 border-danger pl-5"
        >
          <p className="label text-danger">The draw did not run</p>
          <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-bone">
            {refusal}
          </p>
        </div>
      )}
      <p className="mt-3 max-w-[56ch] text-sm text-muted">
        {soldOut ? (
          <>
            Picks one guide number at random from the {spotsSold}{" "}
            {spotsSold === 1 ? "guide" : "guides"} sold, held by {buyers}{" "}
            {buyers === 1 ? "buyer" : "buyers"}. Somebody holding five guides
            has five chances. This can only be done once.
          </>
        ) : (
          <span data-not-sold-out>
            {spotsSold} of {totalSpots} guides sold. The drop is drawn once
            every guide sells. Presentation mode can be rehearsed now.
          </span>
        )}
      </p>

      {spotsSold > 0 && unnamedBuyers !== 0 && (
        <p className="mt-3 max-w-[56ch] text-sm text-amber" data-unnamed-buyers>
          {unnamedBuyers === null
            ? "Couldn't check which buyers agreed to be named on the broadcast. Reload before filming."
            : `${unnamedBuyers} ${unnamedBuyers === 1 ? "buyer has" : "buyers have"} not agreed to be named on the broadcast, because they bought before checkout asked. On the roster and the wheel they appear by guide number, not by name.`}
        </p>
      )}

      {/* Presentation mode is the intended route: it runs the same
          commit, then reveals it. This plain button stays as the fallback
          for a draw nobody is filming. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`/draw/${gameId}`}
          className="control control-caution"
        >
          {soldOut ? "Presentation mode" : "Rehearse the presentation"}
        </a>
        {soldOut && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="control"
          >
            Draw without ceremony
          </button>
        )}
      </div>

      {soldOut && confirming && (
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
              One guide number is picked from the {spotsSold} sold. The
              drop is marked drawn and cannot be drawn again.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await drawWinner(gameId);
                    setConfirming(false);
                    if (!result.ok) {
                      setRefusal(result.error);
                      return;
                    }
                    setRefusal(null);
                    // The server revalidates, but this page was rendered
                    // before the draw; ask for the new one.
                    router.refresh();
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
