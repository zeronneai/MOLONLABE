"use client";

// The in-store sale form in a popup, opened from a drop's row on the
// drops list. A full-screen sheet on a phone, because that is how it is
// used behind the counter; a box in the middle on a larger screen.
//
// Closing it (the Cancel button, the ✕, or Escape) unmounts the form, so
// anything typed and not saved is simply gone and nothing is recorded.
// Clicking outside does not close it: with a customer waiting, a stray
// tap that threw away their details would cost more than it saves.

import { useEffect, useRef, useState } from "react";
import InStoreSaleForm, { type DropAfterSale } from "@/components/admin/InStoreSaleForm";

export default function InStoreSaleDialog({
  gameId,
  gameTitle,
  available,
  onRecorded,
  onClose,
}: {
  gameId: string;
  gameTitle: string;
  available: number;
  onRecorded: (drop: DropAfterSale) => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // After a sale there is nothing to cancel: it is recorded. Only Close.
  const [phase, setPhase] = useState<"form" | "done">("form");

  // Escape closes; the page behind does not scroll while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex bg-ink/85 sm:items-center sm:justify-center sm:p-6"
      data-in-store-dialog-backdrop
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Record an in-store sale: ${gameTitle}`}
        data-in-store-dialog
        className="flex h-full w-full flex-col overflow-y-auto bg-surface sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:border sm:hairline"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b hairline bg-surface px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="label text-amber">Record an in-store sale</p>
            <p className="display mt-1 truncate text-lg">{gameTitle.toUpperCase()}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={phase === "form" ? "Close without saving" : "Close"}
            className="control control-sm shrink-0"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5 sm:px-6">
          <p className="mb-6 text-sm text-muted" data-in-store-dialog-left>
            <span className="display text-2xl text-bone tabular-nums">{available}</span>{" "}
            {available === 1 ? "guide" : "guides"} left in this drop. Paid at the register;
            no card is charged here.
          </p>
          <InStoreSaleForm
            gameId={gameId}
            available={available}
            onRecorded={onRecorded}
            onClose={onClose}
            onPhase={setPhase}
            autoFocus
          />
          {phase === "form" && (
            <button
              type="button"
              onClick={onClose}
              className="label mt-6 block h-11 text-muted hover:text-bone"
              data-in-store-cancel
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
