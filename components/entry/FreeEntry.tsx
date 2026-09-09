"use client";

// The no-purchase method. This is a complete, working entry form sitting
// on the page in its own bordered box — not a link, not a modal, not a
// mailing address buried in the rules. It takes exactly the same fields
// as a paid entry and produces exactly the same kind of record, and it is
// the only method that works today.

import { useActionState, useEffect, useRef } from "react";
import { submitFreeEntry, type EntryState } from "@/app/actions/entry";
import { track } from "@/lib/analytics";
import { ENTRY_CLAIM } from "@/lib/legal";

const initial: EntryState = { status: "idle" };

export default function FreeEntry({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState(submitFreeEntry, initial);
  const started = useRef(false);

  // entry_start fires once, on the first sign of intent.
  const onFirstInput = () => {
    if (started.current) return;
    started.current = true;
    track("entry_start", { campaign_id: campaignId });
  };

  useEffect(() => {
    if (state.status === "success") {
      track("entry_submit", { campaign_id: campaignId, method: "free" });
    }
  }, [state.status, campaignId]);

  if (state.status === "success") {
    return (
      <div className="border border-acid p-8 sm:p-10">
        <p className="label text-acid">You&apos;re in</p>
        <p className="display mt-4 text-2xl sm:text-3xl">ENTRY RECEIVED.</p>
        <p className="mt-4 max-w-[52ch] text-sm text-muted">
          {state.message ?? ENTRY_CLAIM.received}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-bone p-8 sm:p-10">
      <p className="label text-acid">{ENTRY_CLAIM.formLabel}</p>
      <h3 className="display mt-4 text-2xl sm:text-3xl">ENTER WITHOUT BUYING.</h3>
      <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-muted">
        {ENTRY_CLAIM.formBody}
      </p>

      <form action={action} className="mt-8" onFocusCapture={onFirstInput}>
        <input type="hidden" name="campaign_id" value={campaignId} />
        {/* honeypot */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-px w-px opacity-0"
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="fe-first">
              First name
            </label>
            <input
              id="fe-first"
              name="first_name"
              autoComplete="given-name"
              className={`field-input ${state.fieldErrors?.first_name ? "field-error" : ""}`}
            />
            {state.fieldErrors?.first_name && (
              <p className="label mt-2 text-danger">{state.fieldErrors.first_name}</p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="fe-last">
              Last name
            </label>
            <input
              id="fe-last"
              name="last_name"
              autoComplete="family-name"
              className={`field-input ${state.fieldErrors?.last_name ? "field-error" : ""}`}
            />
            {state.fieldErrors?.last_name && (
              <p className="label mt-2 text-danger">{state.fieldErrors.last_name}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="fe-email">
              Email
            </label>
            <input
              id="fe-email"
              name="email"
              type="email"
              autoComplete="email"
              className={`field-input ${state.fieldErrors?.email ? "field-error" : ""}`}
            />
            {state.fieldErrors?.email && (
              <p className="label mt-2 text-danger">{state.fieldErrors.email}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="fe-phone">
              Phone <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="fe-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              className="field-input"
            />
          </div>
        </div>

        {state.status === "error" && state.message && (
          <p aria-live="polite" className="label mt-6 text-danger">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="cta-primary control-go mt-8 w-full sm:w-auto"
        >
          {pending ? "Entering…" : "Enter free"}
        </button>
      </form>
    </div>
  );
}
