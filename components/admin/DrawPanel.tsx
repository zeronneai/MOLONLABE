"use client";

// The draw. Weighted by entry_count, so every entry is one ticket and a
// free entry is worth exactly what a purchased one is worth. Irreversible
// in practice, so it sits behind a confirmation that names the campaign
// and states the pool size.

import { useState, useTransition } from "react";
import { drawWinner } from "@/app/admin/actions";

export default function DrawPanel({
  campaignId,
  campaignTitle,
  entries,
  entrants,
  winnerName,
}: {
  campaignId: string;
  campaignTitle: string;
  entries: number;
  entrants: number;
  winnerName: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (winnerName) {
    return (
      <section className="mt-20 border-t hairline pt-10">
        <h2 className="label text-acid">Winner drawn</h2>
        <p className="display mt-4 text-2xl">{winnerName.toUpperCase()}</p>
        <p className="mt-3 max-w-[56ch] text-sm text-muted">
          Drawn from {entries} {entries === 1 ? "entry" : "entries"} across{" "}
          {entrants} {entrants === 1 ? "entrant" : "entrants"}. They appear
          under past winners on the featured page.
        </p>
        <a href={`/draw/${campaignId}`} className="control mt-6">
          Open presentation
        </a>
      </section>
    );
  }

  return (
    <section className="mt-20 border-t hairline pt-10">
      <h2 className="label text-amber">Draw a winner</h2>
      <p className="mt-3 max-w-[56ch] text-sm text-muted">
        Picks one entry at random from all {entries}{" "}
        {entries === 1 ? "entry" : "entries"} in the pot ({entrants}{" "}
        {entrants === 1 ? "entrant" : "entrants"}). Entries are weighted, so
        somebody with five entries has five tickets. This closes the
        campaign and can only be done once.
      </p>

      {/* Presentation mode is the intended route: it runs the same
          commit, then reveals it. This plain button stays as the fallback
          for a draw nobody is filming. */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={`/draw/${campaignId}`}
          className="control control-caution"
          aria-disabled={entries === 0}
        >
          Presentation mode
        </a>
        <button
          type="button"
          disabled={entries === 0 || pending}
          onClick={() => setConfirming(true)}
          className="control"
        >
          {entries === 0 ? "No entries yet" : "Draw without ceremony"}
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
              Draw the winner for {campaignTitle.toUpperCase()}?
            </p>
            <p className="mt-3 text-sm text-muted">
              One entry is picked from {entries}. The campaign is marked
              awarded and cannot be drawn again.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await drawWinner(campaignId);
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
