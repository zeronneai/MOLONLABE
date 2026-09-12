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

/**
 * Below this, the count is stated next to the control rather than left
 * to be discovered. Five is where "plenty" stops being true for a pool
 * people are actively racing each other for.
 */
const LOW_SPOTS = 5;

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
  /** The cart total after the last add, so the button can say it. */
  const [inCart, setInCart] = useState<number | null>(null);

  // What is left is the only bound. There used to be a second one of 25
  // that nobody had decided on; it turned the best customer this feature
  // will ever have — the person who wants twenty spots — away at the
  // control.
  const cap = Math.max(1, remaining);
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

      {/* Said before the control is touched, not after. Discovering at
          checkout that only three were left is the thing that wastes a
          customer's time, and it is worse than any cart bug. */}
      {remaining <= LOW_SPOTS && (
        <p className="label mt-4 text-amber">
          {remaining === 1
            ? "One spot left."
            : `Only ${remaining} spots left — that is all you can take.`}
        </p>
      )}
      {remaining > LOW_SPOTS && clamped === cap && (
        <p className="label mt-4 text-amber">That is every spot left.</p>
      )}

      <button
        type="button"
        onClick={() => {
          setInCart(addSpots(gameId, clamped));
          router.refresh();
        }}
        className="cta-primary control-go mt-8 w-full sm:w-auto"
      >
        {`Take ${clamped === 1 ? "a spot" : `${clamped} spots`}`}
      </button>

      {/* The button no longer becomes "In your cart" and stop there. It
          stays a buy control, because taking more is a thing people do,
          and what changed is said next to it instead — with the running
          total, since adding three to two and being told only "added" is
          a silent success. */}
      {inCart !== null && (
        <p role="status" className="mt-4 text-sm">
          <span className="text-acid">
            {inCart === 1 ? "1 spot" : `${inCart} spots`} in your cart.
          </span>{" "}
          <a href="/cart" className="underline">
            Go to cart
          </a>
        </p>
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
