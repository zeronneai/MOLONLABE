"use client";

// The in-store sale form, shared by the drop page and the popup on the
// drops list. One form, one server action (recordInStoreSale), so the
// two places cannot drift into different rules.
//
// Built for the counter: somebody is standing there waiting. So it
// submits without a page load, keeps everything typed if the sale is
// refused (a form `action` in React 19 clears its fields after every
// submission, refused or not, which would mean typing a customer's
// details twice), cannot be sent twice by a double tap, and on success
// shows the guide numbers large enough to copy onto a receipt.

import { useEffect, useRef, useState, useTransition } from "react";
import { recordInStoreSale, type InStoreState } from "@/app/admin/instore";
import { IN_STORE_ACKNOWLEDGEMENT } from "@/lib/games/terms";

export type DropAfterSale = NonNullable<InStoreState["drop"]>;

const idle: InStoreState = { status: "idle" };

export default function InStoreSaleForm({
  gameId,
  available,
  onRecorded,
  onClose,
  onPhase,
  autoFocus = false,
}: {
  gameId: string;
  /** Guides the website could still sell when this opened. */
  available: number;
  /** After each sale, the drop's new numbers. */
  onRecorded?: (drop: DropAfterSale) => void;
  /** Present in the popup: offers Close beside Record another. */
  onClose?: () => void;
  autoFocus?: boolean;
  /** Told whether the form is being filled in or showing a recorded sale. */
  onPhase?: (phase: "form" | "done") => void;
}) {
  const [state, setState] = useState<InStoreState>(idle);
  const [left, setLeft] = useState(available);
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const done = state.status === "success" && state.sale;

  useEffect(() => setLeft(available), [available]);
  useEffect(() => onPhase?.(done ? "done" : "form"), [done, onPhase]);
  useEffect(() => {
    if (autoFocus && !done) firstRef.current?.focus();
  }, [autoFocus, done]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A second tap while the first is on its way would be a second sale.
    if (sending.current) return;
    sending.current = true;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await recordInStoreSale(idle, data);
        setState(result);
        if (result.status === "success" && result.drop) {
          setLeft(result.drop.remaining);
          onRecorded?.(result.drop);
        }
      } catch {
        setState({ status: "error", message: "The sale could not be recorded. Nothing was saved. Try again." });
      } finally {
        sending.current = false;
      }
    });
  };

  const another = () => {
    setState(idle);
    // The form is re-rendered empty; focus goes straight to the first field.
    requestAnimationFrame(() => firstRef.current?.focus());
  };

  if (done && state.sale) {
    const { numbers, orderNumber } = state.sale;
    return (
      <div data-in-store-done className="text-center sm:text-left">
        <p className="label text-acid">
          {numbers.length === 1 ? "Guide number" : "Guide numbers"}
        </p>
        <p
          data-in-store-numbers
          className="display mt-3 break-words text-[clamp(3rem,16vw,5.5rem)] leading-none text-bone tabular-nums"
        >
          {numbers.join(", ")}
        </p>
        <p className="mt-4 text-sm text-muted">Write {numbers.length === 1 ? "it" : "them"} on the customer&apos;s receipt.</p>
        <p
          role="status"
          data-in-store-result="success"
          className="mx-auto mt-6 max-w-[48ch] text-sm text-acid sm:mx-0"
        >
          {state.message}
        </p>
        <p className="label mt-3 text-muted">
          Order {orderNumber} · <span data-in-store-left>{left}</span> {left === 1 ? "guide" : "guides"} left
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {left > 0 && (
            <button type="button" onClick={another} className="cta-primary control-go w-full sm:w-auto">
              Record another sale
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="control w-full sm:w-auto">
              Close
            </button>
          )}
        </div>
        {left === 0 && <p className="label mt-4 text-amber">This drop is now sold out.</p>}
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate={false}>
      <input type="hidden" name="game_id" value={gameId} />
      <Field label="First name" name="first_name" required inputRef={firstRef} autoCapitalize="words" />
      <Field label="Last name" name="last_name" required autoCapitalize="words" />
      <Field label="Phone" name="phone" type="tel" inputMode="tel" required />
      <Field label="Email (optional)" name="email" type="email" inputMode="email" />
      <label className="block">
        <span className="label text-muted">Number of guides</span>
        <input
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, left)}
          defaultValue={1}
          required
          className="field-input mt-2 w-full"
        />
        <span className="label mt-2 block text-muted">
          <span data-in-store-left>{left}</span> available right now
        </span>
      </label>
      <label className="flex items-start gap-3 sm:col-span-2">
        <input
          type="checkbox"
          name="agreed"
          required
          className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-acid)]"
        />
        <span className="text-sm leading-relaxed">{IN_STORE_ACKNOWLEDGEMENT}</span>
      </label>
      {state.status === "error" && state.message && (
        <p role="alert" data-in-store-result="error" className="text-sm text-danger sm:col-span-2">
          {state.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="cta-primary control-go w-full sm:w-auto">
          {pending ? "Recording…" : "Record the sale"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  inputMode,
  autoCapitalize,
  inputRef,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoCapitalize?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="label text-muted">{label}</span>
      <input
        ref={inputRef}
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoComplete="off"
        className="field-input mt-2 w-full"
      />
    </label>
  );
}
