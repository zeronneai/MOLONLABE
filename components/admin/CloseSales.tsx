"use client";

// End a drop's sales before it sells out. Owner and manager.
//
// Built because the shop needed it and had no way to do it: on 30
// October a drop was drawn at 44 of 66 for Halloween, and the only way
// to stop it selling was to record the unsold guides as a fake sale.
// This does the same job honestly: nobody can buy in, the drop keeps the
// guides it really sold, and it can then be drawn from those.
//
// Confirmation is on the page, not a browser dialog, because a browser
// dialog blocks everything behind it on a phone.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeDropSales } from "@/app/admin/actions";

export default function CloseSales({
  gameId,
  gameTitle,
  status,
  closedAt,
  closedBy,
  sold,
  total,
}: {
  gameId: string;
  gameTitle: string;
  status: string;
  closedAt: string | null;
  closedBy: string | null;
  sold: number;
  total: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  if (closedAt) {
    const when = new Date(closedAt).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    return (
      <section data-sales-closed className="mt-20 border-t hairline pt-10">
        <h2 className="label text-amber">Sales closed</h2>
        <p className="mt-3 max-w-[56ch] text-sm text-muted">
          Closed {when}
          {closedBy ? ` by ${closedBy}` : ""} at {sold} of {total} guides
          sold. Nobody can buy into this drop. It is drawn from the {sold}{" "}
          {sold === 1 ? "guide" : "guides"} sold.
        </p>
      </section>
    );
  }

  if (status !== "open") return null;

  const unsold = Math.max(0, total - sold);

  return (
    <section data-close-sales className="mt-20 border-t hairline pt-10">
      <h2 className="label text-amber">End this drop early</h2>
      <p className="mt-3 max-w-[56ch] text-sm text-muted">
        {sold} of {total} guides sold. Closing sales stops anyone buying
        more, online or at the counter. The drop is then drawn from the{" "}
        {sold} {sold === 1 ? "guide" : "guides"} already sold. Use this when
        the drop has to end before it sells out, for example on the date it
        was promoted for.
      </p>

      {sold < 1 ? (
        <p className="label mt-5 text-muted">
          Nothing has sold yet, so there is nothing to close.
        </p>
      ) : !confirming ? (
        <button
          type="button"
          onClick={() => { setMessage(null); setConfirming(true); }}
          className="control control-caution mt-6"
        >
          Close sales
        </button>
      ) : (
        <div role="group" aria-label="Confirm closing sales" className="mt-6 border hairline p-5">
          <p className="display text-lg">
            Close sales for {gameTitle.toUpperCase()}?
          </p>
          <p className="mt-3 text-sm text-muted">
            The {unsold} unsold {unsold === 1 ? "guide stays" : "guides stay"}{" "}
            unsold and can never be bought. This cannot be undone.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await closeDropSales(gameId);
                  setConfirming(false);
                  setMessage({ ok: r.status !== "error", text: r.message ?? "" });
                  router.refresh();
                })
              }
              className="control control-caution flex-1"
            >
              {pending ? "Closing…" : "Yes, close sales"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="control flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={`label mt-4 ${message.ok ? "text-acid" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
