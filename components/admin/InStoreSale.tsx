"use client";

// Record an in-store sale, and the list of in-store sales for this drop.
//
// For the owner and the manager. A sale at the counter takes real guide
// numbers, lowest available first, exactly as an online purchase does,
// and the buyer is in the drawing like anybody else. Nothing is charged
// here: the money and the tax were taken at the register.
//
// Voiding is the owner's. It is for mistakes (a sale entered twice, the
// wrong number of guides), it returns the guides to sale and takes the
// buyer out of the drawing, and once the drop is drawn it cannot happen.

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordInStoreSale, voidInStoreSale, type InStoreState } from "@/app/admin/instore";
import { OwnerOnlyNote, useIsOwner } from "@/components/admin/Role";
import { IN_STORE_ACKNOWLEDGEMENT } from "@/lib/games/terms";

export type InStoreSaleRow = {
  id: string;
  orderNumber: string;
  buyer: string;
  numbers: number[];
  recordedBy: string | null;
  at: string;
  voidedAt: string | null;
  voidedBy: string | null;
};

const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const idle: InStoreState = { status: "idle" };

export default function InStoreSale({
  gameId,
  status,
  available,
  drawn,
  sales,
}: {
  gameId: string;
  status: string;
  /** Guides the website could still sell right now. */
  available: number;
  drawn: boolean;
  sales: InStoreSaleRow[];
}) {
  const [state, action, pending] = useActionState(recordInStoreSale, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // A recorded sale clears the form, so the next buyer at the counter
  // starts from blank rather than from the last one's details.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const open = status === "open" && !drawn;

  return (
    <section data-in-store-sale className="mt-14 border-t hairline pt-8">
      <h2 className="label text-amber">Record an in-store sale</h2>
      <p className="mt-3 max-w-[60ch] text-sm text-muted">
        For guides sold at the counter and paid at the register. The buyer
        gets the next available guide numbers, the website stops selling
        them, and the buyer is in the drawing like any online buyer. No card
        is charged here.
      </p>

      {!open ? (
        <p className="mt-4 text-sm text-muted" data-in-store-closed>
          {drawn
            ? "This drop has been drawn. No more guides can be sold."
            : status === "full"
              ? "This drop is sold out. There are no guides left to sell."
              : "This drop is not on sale."}
        </p>
      ) : (
        <form ref={formRef} action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="game_id" value={gameId} />
          <Field label="First name" name="first_name" autoComplete="off" required />
          <Field label="Last name" name="last_name" autoComplete="off" required />
          <Field label="Phone" name="phone" type="tel" autoComplete="off" required />
          <Field label="Email (for the guide; optional)" name="email" type="email" autoComplete="off" />
          <label className="block">
            <span className="label text-muted">Number of guides</span>
            <input
              name="quantity"
              type="number"
              min={1}
              max={Math.max(1, available)}
              defaultValue={1}
              required
              className="field-input mt-2 w-full"
            />
            <span className="label mt-2 block text-muted">{available} available right now</span>
          </label>
          <label className="flex items-start gap-3 sm:col-span-2">
            <input
              type="checkbox"
              name="agreed"
              required
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-acid)]"
            />
            <span className="text-sm leading-relaxed">{IN_STORE_ACKNOWLEDGEMENT}</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="cta-primary control-go">
              {pending ? "Recording…" : "Record the sale"}
            </button>
          </div>
        </form>
      )}

      {state.status !== "idle" && state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          data-in-store-result={state.status}
          className={`mt-4 max-w-[60ch] text-sm ${state.status === "error" ? "text-danger" : "text-acid"}`}
        >
          {state.message}
        </p>
      )}

      {sales.length > 0 && (
        <div className="mt-10">
          <h3 className="label text-muted">In-store sales on this drop</h3>
          <div className="mt-4 border-t hairline">
            {sales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} drawn={drawn} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SaleRow({ sale, drawn }: { sale: InStoreSaleRow; drawn: boolean }) {
  const owner = useIsOwner();
  const [state, action, pending] = useActionState(voidInStoreSale, idle);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <div data-in-store-row={sale.orderNumber} className="border-b hairline py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm">
          <span className="font-extrabold tracking-[-0.02em]">{sale.orderNumber}</span>
          <span className="ml-3">{sale.buyer}</span>
          <span className="ml-3 text-muted">
            {sale.numbers.length === 1 ? "guide" : "guides"} {sale.numbers.join(", ")}
          </span>
        </p>
        {sale.voidedAt ? (
          <span className="label text-danger">Voided</span>
        ) : drawn ? (
          <span className="label text-muted">Drawn, cannot be voided</span>
        ) : (
          <button
            type="button"
            disabled={!owner || pending}
            aria-disabled={!owner}
            onClick={() => setConfirming(true)}
            className="control control-sm control-danger"
          >
            Void
          </button>
        )}
      </div>
      <p className="label mt-1 text-muted">
        Recorded {stamp(sale.at)} by {sale.recordedBy ?? "staff"}
        {sale.voidedAt ? ` · voided ${stamp(sale.voidedAt)} by ${sale.voidedBy ?? "the owner"}` : ""}
      </p>
      {!owner && !sale.voidedAt && !drawn && <OwnerOnlyNote />}

      {confirming && owner && (
        <form action={action} className="mt-3 flex flex-wrap items-center gap-3" onSubmit={() => setConfirming(false)}>
          <input type="hidden" name="order_id" value={sale.id} />
          <p className="text-sm text-bone">
            Void {sale.orderNumber}? {sale.numbers.length === 1 ? "Guide" : "Guides"}{" "}
            {sale.numbers.join(", ")} go back on sale and {sale.buyer} is taken out of the drawing.
          </p>
          <button type="submit" className="control control-sm control-danger-fill">
            Void the sale
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="control control-sm">
            Keep it
          </button>
        </form>
      )}
      {state.status !== "idle" && state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          data-void-result={state.status}
          className={`mt-2 text-sm ${state.status === "error" ? "text-danger" : "text-acid"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="label text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="field-input mt-2 w-full"
      />
    </label>
  );
}
