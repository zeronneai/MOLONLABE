"use client";

// Taking spots.
//
// The terms sit next to this control rather than only on the rules page,
// because this is where the money decision happens and "runs until it
// sells out, no refunds" is the part people are most likely to assume
// wrongly. They are repeated at checkout as a required checkbox that
// blocks payment — this placement is the warning, that one is the
// consent.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart/store";
import { formatUsd } from "@/lib/money";
import { GAME_TERMS } from "@/lib/games/terms";
import { MAX_SPOTS_PER_ORDER } from "@/lib/games/types";

export default function BuySpots({
  gameId,
  spotPriceCents,
  remaining,
}: {
  gameId: string;
  spotPriceCents: number;
  remaining: number;
}) {
  const { addSpots } = useCart();
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [added, setAdded] = useState(false);

  const cap = Math.max(1, Math.min(remaining, MAX_SPOTS_PER_ORDER));
  const clamped = Math.max(1, Math.min(count, cap));

  if (remaining === 0) {
    return (
      <div className="mt-10 border-l-2 border-amber pl-5">
        <p className="display text-2xl">SOLD OUT.</p>
        <p className="mt-3 max-w-[52ch] text-sm text-muted">
          Every spot is gone. The draw happens next — the winner is posted
          here and announced on Instagram.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
        <div>
          <label className="field-label" htmlFor="spot-count">
            How many spots
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="One fewer"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              disabled={clamped <= 1}
              className="control control-sm !w-12 !px-0 disabled:opacity-40"
            >
              −
            </button>
            <input
              id="spot-count"
              inputMode="numeric"
              value={clamped}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value.replace(/\D/g, "")));
                setCount(Number.isFinite(n) && n > 0 ? Math.min(n, cap) : 1);
              }}
              className="field-input !w-20 text-center tabular-nums"
            />
            <button
              type="button"
              aria-label="One more"
              onClick={() => setCount((c) => Math.min(cap, c + 1))}
              disabled={clamped >= cap}
              className="control control-sm !w-12 !px-0 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <p className="label text-muted">Total</p>
          <p className="display mt-2 text-3xl tabular-nums">
            {formatUsd(spotPriceCents * clamped)}
          </p>
        </div>
      </div>

      {clamped === cap && cap < MAX_SPOTS_PER_ORDER && (
        <p className="label mt-4 text-amber">
          That is every spot left.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          addSpots(gameId, clamped);
          setAdded(true);
          router.refresh();
        }}
        className="cta-primary control-go mt-8 w-full sm:w-auto"
      >
        {added
          ? "In your cart"
          : `Take ${clamped === 1 ? "a spot" : `${clamped} spots`}`}
      </button>

      {added && (
        <a href="/cart" className="control ml-0 mt-3 block sm:ml-3 sm:mt-0 sm:inline-block">
          Go to cart
        </a>
      )}

      {/* Placement 1 of 2. The consent checkbox at checkout is the one
          that blocks payment; this is here so nobody reaches it
          surprised. */}
      <ul className="mt-10 max-w-[56ch] space-y-2 border-t hairline pt-6">
        {GAME_TERMS.map((line) => (
          <li key={line} className="text-sm leading-relaxed text-amber">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
