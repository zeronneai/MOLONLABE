"use client";

// Who holds what, for the owner only.
//
// This is the one screen that shows real names against spot numbers. It
// is behind auth, it reads the table rather than the public view, and it
// marks which buyers agreed to appear on the public board — so the owner
// can see at a glance that most of them did not, and why the board looks
// sparse.

import { useState } from "react";

type Row = {
  spotNumber: number;
  status: "open" | "held" | "sold";
  name: string | null;
  email: string | null;
  soldAt: string | null;
};

export default function SpotLedger({
  spots,
  gameId,
}: {
  spots: Row[];
  gameId: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const sold = spots.filter((s) => s.status === "sold");
  const held = spots.filter((s) => s.status === "held");
  const shown = showAll ? sold : sold.slice(0, 12);

  return (
    <section className="mt-14 border-t hairline pt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="label text-muted">Spots sold</h2>
        <a
          href={`/admin/games/${gameId}/spots.csv`}
          className="label text-muted hover:text-bone"
        >
          Download CSV
        </a>
      </div>

      {held.length > 0 && (
        <p className="label mt-4 text-amber">
          {held.length} {held.length === 1 ? "spot is" : "spots are"} mid-checkout.
          They go back on sale by themselves if the payment never lands.
        </p>
      )}

      {sold.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing sold yet.</p>
      ) : (
        <>
          <p className="mt-4 max-w-[60ch] text-sm text-muted">
            Buyer details, for you only. Nothing on this list is public —
            the game page shows how many spots remain and nothing else.
          </p>
          <div className="mt-6 border-t hairline">
            {shown.map((s) => (
              <div
                key={s.spotNumber}
                className="flex items-baseline gap-4 border-b hairline py-3"
              >
                <span className="display w-12 shrink-0 text-lg tabular-nums">
                  {s.spotNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {s.name}
                </span>
                <span className="shrink-0 truncate text-sm text-muted">
                  {s.email}
                </span>
              </div>
            ))}
          </div>
          {sold.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="label mt-4 flex h-11 items-center text-muted hover:text-bone"
            >
              {showAll ? "Show fewer" : `Show all ${sold.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
