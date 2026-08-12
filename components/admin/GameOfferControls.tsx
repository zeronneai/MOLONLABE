"use client";

import { useActionState, useTransition } from "react";
import { saveGameDifficulty, saveGameOffer, toggleGameOffer } from "@/app/admin/actions";
import { DEFAULT_EXCLUSION_NOTE } from "@/lib/admin/constants";
import { DIFFICULTY_RANGES } from "@/lib/game/settings";

export interface OfferValue {
  enabled: boolean;
  code: string;
  value: string;
  expires: string | null;
  note: string;
}

// The kill switch. Lives at the top of the screen; one tap, no confirm.
export function OfferSwitch({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      disabled={pending}
      onClick={() => start(() => toggleGameOffer(!enabled))}
      className={`control w-full justify-between !px-5 ${
        enabled ? "tone-acid" : "tone-danger"
      }`}
    >
      <span className="label">{enabled ? "Offer is live" : "Offer is off"}</span>
      <span className={`label ${enabled ? "text-acid" : "text-danger"}`}>
        {pending ? "…" : enabled ? "Tap to switch off" : "Tap to switch on"}
      </span>
    </button>
  );
}

export function OfferForm({ offer }: { offer: OfferValue }) {
  const [state, action, pending] = useActionState(saveGameOffer, {
    status: "idle" as const,
  });

  return (
    <form action={action} className="mt-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="g-code">Code</label>
          <input
            id="g-code"
            name="code"
            defaultValue={offer.code}
            autoCapitalize="characters"
            className="field-input uppercase tracking-[0.2em]"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="g-expires">Expires</label>
          <input
            id="g-expires"
            name="expires"
            type="date"
            defaultValue={offer.expires ?? ""}
            className="field-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="g-value">What they get</label>
          <input
            id="g-value"
            name="value"
            defaultValue={offer.value}
            placeholder="10% off one accessory"
            className="field-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="g-note">What it excludes</label>
          <textarea
            id="g-note"
            name="note"
            defaultValue={offer.note || DEFAULT_EXCLUSION_NOTE}
            className="field-input"
          />
          <p className="mt-2 text-[11px] text-muted">
            Never leave this empty — a discount with no stated limits is a
            discount on everything. Blank saves reset it to the default.
          </p>
        </div>
      </div>
      {state.message && (
        <p
          aria-live="polite"
          className={`mt-4 text-[11px] uppercase tracking-[0.18em] ${
            state.status === "error" ? "text-danger" : "text-acid"
          }`}
        >
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="cta-primary mt-8 disabled:opacity-50">
        {pending ? "Saving…" : "Save reward"}
      </button>
    </form>
  );
}

export function DifficultyForm({
  mode,
  values,
  winRate,
}: {
  mode: "desktop" | "mobile";
  values: { roundMs: number; targetCount: number; popMs: number; magSize: number };
  winRate: number | null;
}) {
  const [state, action, pending] = useActionState(saveGameDifficulty, {
    status: "idle" as const,
  });
  const r = DIFFICULTY_RANGES;

  return (
    <form action={action} className="border-t hairline pt-6">
      <input type="hidden" name="mode" value={mode} />
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="label text-acid">{mode}</h3>
        <p className="label text-muted">
          Win rate 7d:{" "}
          <span className="text-bone">
            {winRate === null ? "—" : `${Math.round(winRate * 100)}%`}
          </span>
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <label className="field-label" htmlFor={`${mode}-round`}>
            Round (seconds)
          </label>
          <input
            id={`${mode}-round`}
            name="roundSeconds"
            type="number"
            min={r.roundMs.min / 1000}
            max={r.roundMs.max / 1000}
            step={1}
            defaultValue={Math.round(values.roundMs / 1000)}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${mode}-targets`}>
            Targets to win
          </label>
          <input
            id={`${mode}-targets`}
            name="targetCount"
            type="number"
            min={r.targetCount.min}
            max={r.targetCount.max}
            step={1}
            defaultValue={values.targetCount}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${mode}-pop`}>
            Target up time (ms)
          </label>
          <input
            id={`${mode}-pop`}
            name="popMs"
            type="number"
            min={r.popMs.min}
            max={r.popMs.max}
            step={50}
            defaultValue={values.popMs}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${mode}-mag`}>
            Magazine size
          </label>
          <input
            id={`${mode}-mag`}
            name="magSize"
            type="number"
            min={r.magSize.min}
            max={r.magSize.max}
            step={1}
            defaultValue={values.magSize}
            className="field-input"
          />
        </div>
      </div>
      {state.message && (
        <p
          aria-live="polite"
          className={`mt-4 text-[11px] uppercase tracking-[0.18em] ${
            state.status === "error" ? "text-danger" : "text-acid"
          }`}
        >
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="cta-primary mt-6 !h-11 !px-5 disabled:opacity-50">
        {pending ? "Saving…" : `Save ${mode}`}
      </button>
    </form>
  );
}
