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
import {
  GUIDE_FIELDS,
  GUIDE_MIN_CHARS,
  guideFieldErrors,
  type GuideFieldKey,
} from "@/lib/guides/fields";
import type { GameRow } from "@/lib/database.types";

/**
 * What the prize is worth, and where that number came from.
 *
 * A firearm has NO `price_cents` — `items_firearms_have_no_online_price`
 * forbids it, because a price is what makes a thing cartable and a
 * firearm must never be. Its value lives in `price_display`, which is
 * free text the owner typed ("$2,199").
 *
 * So the number is parsed out of that text when there is no real one,
 * and which source was used is reported rather than hidden. A figure the
 * owner is making a money decision against should not quietly be the
 * result of a regex over a label.
 */
function valueOf(item: {
  price_cents: number | null;
  price_display: string | null;
}): { cents: number; exact: boolean } | null {
  if (typeof item.price_cents === "number" && item.price_cents > 0) {
    return { cents: item.price_cents, exact: true };
  }
  const digits = (item.price_display ?? "").replace(/[^0-9.]/g, "");
  const dollars = Number(digits);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;
  return { cents: Math.round(dollars * 100), exact: false };
}

export default function GameForm({
  game,
  items,
}: {
  game?: GameRow;
  items: {
    id: string;
    name: string;
    price_cents: number | null;
    price_display: string | null;
  }[];
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

  // The prize has to be in state, not left to the select's defaultValue,
  // because its value is half of the comparison below.
  const [itemId, setItemId] = useState(game?.item_id ?? "");
  const prize = items.find((i) => i.id === itemId) ?? null;
  const prizeValue = prize ? valueOf(prize) : null;
  const covers = prizeValue && pot > 0 ? pot - prizeValue.cents : null;

  // The three guide sections, in state so the owner sees the count move
  // as he writes rather than being told on submit that he was short.
  const [guide, setGuide] = useState<Record<GuideFieldKey, string>>({
    guide_why: game?.guide_why ?? "",
    guide_care: game?.guide_care ?? "",
    guide_pairs: game?.guide_pairs ?? "",
  });
  const guideErrors = guideFieldErrors(guide);
  const guideReady = Object.keys(guideErrors).length === 0;

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
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
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

        {/* ------------------------------------------------- the guide */}
        {/* Placed directly under the prize and above the money, because
            it is the thing being sold. The customer is buying a written
            guide to this piece; entry into the drawing comes with it.
            Everything else in the guide — the name, the specifications,
            the description, the photographs — is lifted from the item,
            so these three sections are the entire difference between a
            guide and the product page printed out.

            The form refuses to save without them. That is not a
            formality: a game published with these blank is selling
            something that isn't there. */}
        <div className="sm:col-span-2 border-l-2 border-acid pl-5">
          <p className="label text-acid">The guide — what they are paying for</p>
          <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-muted">
            Every customer gets a guide to this piece, made automatically
            from the item — its name, brand, specifications, description
            and photographs. These three sections are the only part that
            is yours, and they are the only part that could not have been
            printed off the website. Write them the way you would say them
            across the counter.
          </p>
          <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-amber">
            This is not optional. A game will not go on sale, and will not
            save afterwards, until all three are filled in.
          </p>

          <div className="mt-8 space-y-8">
            {GUIDE_FIELDS.map((field) => {
              const value = guide[field.key];
              const count = value.trim().length;
              const short = count < GUIDE_MIN_CHARS;
              return (
                <div key={field.key}>
                  <label className="field-label" htmlFor={`g-${field.key}`}>
                    {field.label}
                  </label>
                  <p className="mb-3 mt-2 max-w-[56ch] text-sm text-muted">
                    {field.prompt}
                  </p>
                  <textarea
                    id={`g-${field.key}`}
                    name={field.key}
                    rows={5}
                    value={value}
                    onChange={(e) =>
                      setGuide((g) => ({ ...g, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    aria-describedby={`g-${field.key}-count`}
                    aria-invalid={short}
                    className="field-input"
                  />
                  <p
                    id={`g-${field.key}-count`}
                    aria-live="polite"
                    className={`label mt-2 ${short ? "text-amber" : "text-acid"}`}
                  >
                    {short
                      ? `${count} of ${GUIDE_MIN_CHARS} characters`
                      : `${count} characters`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* The owner is selling this, so he should be able to look at
              it. Built on demand, which means opening it after an edit
              shows the edit. Only offered once the game exists — there
              is nothing to render before that. */}
          {editing && (
            <a
              href={`/admin/games/${game!.id}/guide.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="control control-sm mt-8 inline-block"
            >
              Open the guide as a customer sees it
            </a>
          )}
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

            {/* The arithmetic the owner would otherwise do in his head
                every time: what the game takes if it fills, against what
                the prize costs him. Side by side, because the decision is
                the comparison and not either number alone. */}
            <div className="sm:col-span-2 border-l-2 border-amber pl-5">
              {spotCount > 0 && priceCents > 0 ? (
                <>
                  <div className="flex flex-wrap gap-x-12 gap-y-4">
                    <div>
                      <p className="label text-muted">If it sells out</p>
                      <p className="display mt-2 text-2xl tabular-nums">
                        {formatUsd(pot)}
                      </p>
                      <p className="label mt-1 text-muted">
                        {spotCount} × {formatUsd(priceCents)}
                      </p>
                    </div>

                    <div>
                      <p className="label text-muted">The prize</p>
                      <p className="display mt-2 text-2xl tabular-nums">
                        {prizeValue ? formatUsd(prizeValue.cents) : "—"}
                      </p>
                      <p className="label mt-1 text-muted">
                        {!prize
                          ? "none chosen"
                          : prizeValue
                            ? prizeValue.exact
                              ? prize.name
                              : `${prize.name} · from the listed price`
                            : `${prize.name} · no price on the item`}
                      </p>
                    </div>
                  </div>

                  {covers !== null && (
                    <p
                      className={`mt-5 text-sm leading-relaxed ${
                        covers >= 0 ? "text-acid" : "text-danger"
                      }`}
                    >
                      {covers >= 0 ? (
                        <>
                          Covers the prize with{" "}
                          <strong>{formatUsd(covers)}</strong> over, if
                          every spot sells.
                        </>
                      ) : (
                        <>
                          <strong>
                            {formatUsd(Math.abs(covers))} short of the prize
                          </strong>{" "}
                          even if every spot sells.
                        </>
                      )}
                    </p>
                  )}

                  <p className="label mt-3 max-w-[52ch] text-muted">
                    Before tax, and before anything it costs you to run.
                    Sales tax is added on top of the spot price at
                    checkout, so it is not yours to keep.
                    {prizeValue && !prizeValue.exact && (
                      <>
                        {" "}
                        The prize figure is read from the price shown on
                        the item, since a firearm carries no online price.
                        Check it is current.
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-amber">
                  Set both and this will show what the game brings in if it
                  sells out, against what the prize is worth.
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

      {/* Said here as well as at the field, because this is where the
          owner is looking when he wonders why nothing happened. The
          button is deliberately NOT disabled — the server is the
          authority on this and refuses with the same sentence, and a
          dead button with no explanation is how somebody concludes the
          admin is broken. */}
      {!guideReady && (
        <p className="mt-8 border-l-2 border-amber pl-5 text-sm leading-relaxed text-amber">
          {editing ? "This game cannot be saved" : "This game cannot be created"}{" "}
          until the three guide sections above are filled in.{" "}
          {Object.values(guideErrors)[0]}
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
