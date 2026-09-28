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

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { voidInStoreSale, type InStoreState } from "@/app/admin/instore";
import InStoreSaleForm from "@/components/admin/InStoreSaleForm";
import { OwnerOnlyNote, useIsOwner } from "@/components/admin/Role";

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
  const router = useRouter();
  const open = status === "open" && !drawn;
  // Kept once the drop fills, so the sale that filled it still shows its
  // numbers after the page refreshes around it.
  const [started, setStarted] = useState(false);

  return (
    <section data-in-store-sale className="mt-14 border-t hairline pt-8">
      <h2 className="label text-amber">Record an in-store sale</h2>
      <p className="mt-3 max-w-[60ch] text-sm text-muted">
        For guides sold at the counter and paid at the register. The buyer
        gets the next available guide numbers, the website stops selling
        them, and the buyer is in the drawing like any online buyer. No card
        is charged here.
      </p>

      {!open && (
        <p className="mt-4 text-sm text-muted" data-in-store-closed>
          {drawn
            ? "This drop has been drawn. No more guides can be sold."
            : status === "full"
              ? "This drop is sold out. There are no guides left to sell."
              : "This drop is not on sale."}
        </p>
      )}
      {(open || started) && (
        <div className="mt-6">
          <InStoreSaleForm
            gameId={gameId}
            available={available}
            onRecorded={() => {
              setStarted(true);
              // The ledger and the sales list below are the server's.
              router.refresh();
            }}
          />
        </div>
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
