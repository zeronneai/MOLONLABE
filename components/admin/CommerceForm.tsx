"use client";

// Tax and postage.
//
// The two postage figures are placeholders and the screen says so, loudly
// and next to the fields rather than in a footnote. A number that looks
// settled gets treated as settled, and these will be charged to real
// cards the moment payments open.

import { useActionState } from "react";
import { saveCommerce } from "@/app/admin/actions";
import type { CommerceSettings } from "@/lib/cart/pricing";

export default function CommerceForm({
  settings,
  updatedBy,
  updatedAt,
}: {
  settings: CommerceSettings;
  updatedBy: string | null;
  updatedAt: string | null;
}) {
  const [state, action, pending] = useActionState(saveCommerce, {
    status: "idle" as const,
  });

  const dollars = (cents: number) => (cents / 100).toFixed(2);

  return (
    <form action={action} className="max-w-2xl">
      <section>
        <h2 className="label text-acid">Sales tax</h2>
        <p className="mt-3 max-w-[60ch] text-sm text-muted">
          Applied to the merchandise subtotal only — never to postage, and
          never to anything a customer earns rather than buys.
        </p>
        <div className="mt-6 max-w-xs">
          <label className="field-label" htmlFor="tax">
            Rate (%)
          </label>
          <input
            id="tax"
            name="tax_percent"
            inputMode="decimal"
            defaultValue={(settings.taxRateBps / 100).toFixed(2)}
            className="field-input"
          />
          <p className="label mt-2 text-muted">
            8.25% is the El Paso combined rate, confirmed by the client.
          </p>
        </div>
      </section>

      <section className="mt-14 border-t hairline pt-8">
        <h2 className="label text-amber">Postage — placeholder amounts</h2>
        <div className="mt-4 border-l-2 border-amber pl-5">
          <p className="max-w-[60ch] text-sm leading-relaxed text-amber">
            These two figures are stand-ins. Nobody has decided what postage
            should cost yet, and whatever is in these boxes is what a
            customer will be charged once card payments open. Set them
            before that happens.
          </p>
        </div>

        <p className="mt-6 max-w-[60ch] text-sm text-muted">
          One charge per order, at the higher of the two tiers in the cart.
          Two shirts go in one envelope, so they are billed once. A cart with
          a shirt and a gun case pays the case&apos;s rate. Anything collected
          in store is never charged postage at all.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="standard">
              Standard ($)
            </label>
            <input
              id="standard"
              name="shipping_standard"
              inputMode="decimal"
              defaultValue={dollars(settings.shippingStandardCents)}
              className="field-input"
            />
            <p className="label mt-2 text-muted">
              Apparel and small accessories
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="oversize">
              Oversize ($)
            </label>
            <input
              id="oversize"
              name="shipping_oversize"
              inputMode="decimal"
              defaultValue={dollars(settings.shippingOversizeCents)}
              className="field-input"
            />
            <p className="label mt-2 text-muted">
              Bulky gear — cases, safes, anything in its own box
            </p>
          </div>
        </div>

        <p className="label mt-6 text-muted">
          Collected in store · always $0.00
        </p>
      </section>

      {state.status === "error" && (
        <p
          aria-live="polite"
          className="mt-8 text-[11px] uppercase tracking-[0.18em] text-danger"
        >
          {state.message}
        </p>
      )}
      {state.status === "idle" && state.message && (
        <p aria-live="polite" className="label mt-8 text-acid">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="cta-primary control-go mt-10 w-full sm:w-auto"
      >
        {pending ? "Saving…" : "Save"}
      </button>

      {updatedBy && (
        <p className="label mt-12 border-t hairline pt-5 text-muted">
          Last changed by {updatedBy}
          {updatedAt
            ? ` · ${new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Denver",
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(updatedAt))}`
            : ""}
        </p>
      )}
    </form>
  );
}
