"use client";

// A single toast, mounted once by AdminShell. Archiving is applied
// immediately and the row leaves the list, so the undo affordance cannot
// live on the row — it lives here, above everything, within thumb reach at
// the bottom of the screen.

import { useEffect, useState, useTransition } from "react";

export interface ToastDetail {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<unknown>;
}

const EVENT = "mlf-admin-toast";
const DISMISS_MS = 7000; // long enough to reconsider, short enough to not nag

export function showToast(detail: ToastDetail): void {
  window.dispatchEvent(new CustomEvent<ToastDetail>(EVENT, { detail }));
}

export default function Toast() {
  const [toast, setToast] = useState<ToastDetail | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onToast = (event: Event) => {
      setToast((event as CustomEvent<ToastDetail>).detail);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="px-page fixed inset-x-0 bottom-0 z-50 pb-6"
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 border hairline bg-surface px-5 py-3">
        <p className="label text-bone">{toast.message}</p>
        <div className="flex items-center">
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const run = toast.onAction;
                if (!run) return;
                start(async () => {
                  await run();
                  setToast(null);
                });
              }}
              className="label flex h-11 items-center px-4 text-acid underline underline-offset-4 disabled:opacity-50"
            >
              {pending ? "…" : toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-bone"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
