"use client";

// Creating a game.
//
// Two numbers define it and both are set by hand: how many spots, and
// what one costs. Neither is derived from the item's price, because only
// a person knows what a spot in this particular prize is worth — a $2,200
// rifle might run 100 spots at $30 or 50 at $60, and that is a judgement
// about the customers, not arithmetic.
//
// Both are permanent. The form says so before they are set rather than
// refusing an edit afterwards.

import { useActionState, useState } from "react";
import { saveGame } from "@/app/admin/actions";
import { formatUsd } from "@/lib/money";
import type { GameRow } from "@/lib/database.types";

export default function GameForm({
  game,
  items,
}: {
  game?: GameRow;
  items: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveGame, {
    status: "idle" as const,
  });
  const editing = Boolean(game);

  // Shown live as the two fields are filled in, because "100 spots at $30"
  // is abstract and "$3,000 if it sells out" is the decision being made.
  const [spots, setSpots] = useState(String(game?.total_spots ?? ""));
  const [price, setPrice] = useState(
    game ? (game.spot_price_cents / 100).toFixed(2) : "",
  );
  const spotCount = Math.max(0, Math.round(Number(spots) || 0));
  const priceCents = Math.round((Number(price) || 0) * 100);
  const pot = spotCount * priceCents;

  return (
    <form action={action} className="max-w-2xl">
      {game && <input type="hidden" name="id" value={game.id} />}

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="g-title">
            Title
          </label>
          <input
            id="g-title"
            name="title"
            defaultValue={game?.title}
            placeholder="September Rifle Game"
            className="field-input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="g-item">
            The prize
          </label>
          <select
            id="g-item"
            name="item_id"
            defaultValue={game?.item_id ?? ""}
            className="field-input"
          >
            <option value="" className="bg-surface text-bone">
              — none —
            </option>
            {items.map((i) => (
              <option key={i.id} value={i.id} className="bg-surface text-bone">
                {i.name}
              </option>
            ))}
          </select>
        </div>

        {editing ? (
          /* The numbers are settled. Showing them as text rather than as
             disabled inputs, because a greyed-out field reads as "not yet"
             and these are "never". */
          <div className="sm:col-span-2 border-l-2 border-muted pl-5">
            <p className="field-label">Spots</p>
            <p className="mt-2 text-lg">
              <span className="font-extrabold tracking-[-0.02em]">
                {game!.total_spots}
              </span>{" "}
              <span className="text-muted">at</span>{" "}
              <span className="font-extrabold tracking-[-0.02em]">
                {formatUsd(game!.spot_price_cents)}
              </span>{" "}
              <span className="text-muted">each</span>
            </p>
            <p className="label mt-3 max-w-[52ch] text-muted">
              Fixed when the game was created and not editable. Changing
              the count would orphan or invent spots people already hold;
              changing the price would mean two buyers paid differently
              for the same thing.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="field-label" htmlFor="g-spots">
                How many spots
              </label>
              <input
                id="g-spots"
                name="total_spots"
                inputMode="numeric"
                value={spots}
                onChange={(e) => setSpots(e.target.value)}
                placeholder="100"
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="g-price">
                Price per spot ($)
              </label>
              <input
                id="g-price"
                name="spot_price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="30.00"
                className="field-input"
              />
            </div>

            <div className="sm:col-span-2 border-l-2 border-amber pl-5">
              {spotCount > 0 && priceCents > 0 ? (
                <p className="text-sm leading-relaxed text-amber">
                  {spotCount} spots at {formatUsd(priceCents)} brings in{" "}
                  <strong>{formatUsd(pot)}</strong> if it sells out, before
                  tax. Sales tax is added on top of the spot price at
                  checkout.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-amber">
                  Set both and this will show what the game brings in if it
                  sells out.
                </p>
              )}
              <p className="label mt-3 max-w-[52ch] text-muted">
                Both numbers are permanent once the game is created. The
                spots are laid out immediately and the game opens for sale
                straight away — there is no draft.
              </p>
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="g-desc">
            Description
          </label>
          <textarea
            id="g-desc"
            name="description"
            defaultValue={game?.description ?? ""}
            className="field-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="g-note">
            Note shown after the draw
          </label>
          <input
            id="g-note"
            name="winner_note"
            defaultValue={game?.winner_note ?? ""}
            className="field-input"
          />
        </div>
      </div>

      {state.status === "error" && (
        <p
          aria-live="polite"
          className="mt-6 text-[11px] uppercase tracking-[0.18em] text-danger"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="cta-primary control-go mt-10 w-full sm:w-auto"
      >
        {pending
          ? "Saving…"
          : editing
            ? "Save changes"
            : `Create and open${spotCount > 0 ? ` — ${spotCount} spots` : ""}`}
      </button>
    </form>
  );
}
