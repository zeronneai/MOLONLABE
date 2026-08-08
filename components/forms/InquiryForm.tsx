"use client";

// Shared inquiry form: the detail-page drawer and the transfers page both
// render this with a different `type`. Posts through the submitInquiry
// server action; honeypot field included.

import { useActionState, useEffect, useId } from "react";
import { submitInquiry } from "@/app/actions/inquiry";
import { initialFormState } from "@/lib/forms/schema";
import { track } from "@/lib/analytics";

export default function InquiryForm({
  type,
  itemId,
  itemSlug,
  messageLabel = "Message",
  messagePlaceholder,
  submitLabel = "Send it",
  successNote = "Got it. We'll get back to you, usually same day during shop hours.",
}: {
  type: "item" | "transfer" | "general" | "service";
  itemId?: string;
  itemSlug?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  submitLabel?: string;
  successNote?: string;
}) {
  const [state, action, pending] = useActionState(submitInquiry, initialFormState);
  const uid = useId();

  useEffect(() => {
    if (state.status !== "success") return;
    if (type === "transfer") track("transfer_submit", {});
    else track("inquiry_submit", { type, item_slug: itemSlug });
  }, [state.status, type, itemSlug]);

  if (state.status === "success") {
    return (
      <div aria-live="polite" className="border-t hairline pt-8">
        <p className="label text-acid">Received</p>
        <p className="mt-4 max-w-[50ch] text-muted">{successNote}</p>
      </div>
    );
  }

  const err = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <input type="hidden" name="type" value={type} />
      {itemId && <input type="hidden" name="item_id" value={itemId} />}
      {itemSlug && <input type="hidden" name="item_slug" value={itemSlug} />}
      {/* Honeypot — visually hidden, tab-skipped; bots fill it anyway */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input
          id={`${uid}-website`}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${uid}-name`}>
            Name
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            autoComplete="name"
            className={`field-input ${err.name ? "field-error" : ""}`}
          />
          {err.name && <p className="mt-2 text-[11px] text-danger">{err.name}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor={`${uid}-email`}>
            Email
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            autoComplete="email"
            className={`field-input ${err.email ? "field-error" : ""}`}
          />
          {err.email && <p className="mt-2 text-[11px] text-danger">{err.email}</p>}
        </div>
      </div>

      <div className="mt-8">
        <label className="field-label" htmlFor={`${uid}-phone`}>
          Phone <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id={`${uid}-phone`}
          name="phone"
          type="tel"
          autoComplete="tel"
          className={`field-input ${err.phone ? "field-error" : ""}`}
        />
      </div>

      <div className="mt-8">
        <label className="field-label" htmlFor={`${uid}-message`}>
          {messageLabel}
        </label>
        <textarea
          id={`${uid}-message`}
          name="message"
          placeholder={messagePlaceholder}
          className={`field-input ${err.message ? "field-error" : ""}`}
        />
        {err.message && (
          <p className="mt-2 text-[11px] text-danger">{err.message}</p>
        )}
      </div>

      {state.status === "error" && state.message && (
        <p aria-live="polite" className="mt-6 text-[11px] uppercase tracking-[0.18em] text-danger">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="cta-primary mt-10 disabled:opacity-50">
        {pending ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
