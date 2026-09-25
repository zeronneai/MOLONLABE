"use client";

// After the draw: record that the winner claimed the prize.
//
// The featured piece is off the website from the moment of the draw,
// hidden until claimed. This turns it into a sale on the record. An
// unclaimed prize simply stays hidden and is sold in the shop.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPrizeClaimed } from "@/app/admin/actions";

export default function PrizeClaim({
  gameId,
  pieceName,
  claimed,
}: {
  gameId: string;
  pieceName: string;
  claimed: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  return (
    <div data-prize-claim className="mt-6 border-t hairline pt-5">
      <p className="text-sm text-muted">
        {claimed
          ? `${pieceName} is recorded as claimed and sold.`
          : `${pieceName} is off the website and hidden. Mark it claimed once the winner has confirmed and collected. If it goes unclaimed, it stays hidden and is sold in the shop only.`}
      </p>
      {!claimed && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await markPrizeClaimed(gameId);
              setMessage({ ok: r.status !== "error", text: r.message ?? "" });
              router.refresh();
            })
          }
          className="control mt-4"
        >
          {pending ? "Saving…" : "Prize claimed"}
        </button>
      )}
      {message && (
        <p role="status" className={`label mt-3 ${message.ok ? "text-acid" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
