"use client";

// Permanent delete. Deliberately buried at the bottom of the edit screen,
// behind a confirmation that names the item — a generic "are you sure" is
// the kind of thing people dismiss without reading. When anything still
// references the item the action is refused outright and points at
// Archive, which is almost always what was actually meant.

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteItem } from "@/app/admin/actions";
import type { ItemReferences } from "@/lib/db/itemRefs";

export default function DeleteItem({
  id,
  name,
  refs,
}: {
  id: string;
  name: string;
  refs: ItemReferences;
}) {
  const [state, action, pending] = useActionState(deleteItem, {
    status: "idle" as const,
  });
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const blocked = refs.total > 0;

  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  return (
    <section className="mt-20 border-t hairline pt-10">
      <h2 className="label text-danger">Delete permanently</h2>
      <p className="mt-3 max-w-[56ch] text-sm text-muted">
        {blocked ? (
          <>
            {refs.label} still reference this item, so it can&apos;t be deleted —
            removing it would take that history with it. Archive it instead:
            it leaves the public site and everything linked to it stays intact.
          </>
        ) : (
          <>
            For records created by mistake. This removes the item and its
            uploaded images for good. If it ever existed in the case, archive
            it instead so its history survives.
          </>
        )}
      </p>

      <button
        type="button"
        disabled={blocked || pending}
        aria-disabled={blocked}
        onClick={() => setConfirming(true)}
        className="label mt-6 flex h-14 items-center border border-danger px-6 text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:border-muted disabled:text-muted disabled:hover:bg-transparent"
      >
        Delete this item
      </button>

      {state.status === "error" && (
        <p aria-live="polite" className="label mt-4 text-danger">
          {state.message}
        </p>
      )}

      {confirming && !blocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 p-5 sm:items-center"
        >
          <div className="w-full max-w-md border hairline bg-surface p-6">
            <p className="display text-xl">
              Delete {name.toUpperCase()} permanently?
            </p>
            <p className="mt-3 text-sm text-muted">
              This cannot be undone. Its uploaded images are deleted too.
            </p>
            <form action={action} className="mt-8 flex flex-wrap gap-3">
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                disabled={pending}
                className="label flex h-14 flex-1 items-center justify-center border border-danger px-6 text-danger disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setConfirming(false)}
                className="label flex h-14 flex-1 items-center justify-center border hairline px-6 text-bone"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
