"use client";

// Who receives which alert, and a way to prove it.
//
// The test buttons matter as much as the form. The site can only ASK the
// Apps Script to send to these addresses; whether it does depends on the
// script having been updated, and the test is the only way to find out
// short of waiting for a real failure.

import { useActionState } from "react";
import { saveAlertRouting, sendTestAlert } from "@/app/admin/actions";
import { OwnerOnlyNote, useIsOwner } from "@/components/admin/Role";
import type { AlertRouting } from "@/lib/alerts";

const GROUPS = [
  {
    key: "problems",
    title: "Problems with an order",
    body: "A card charged and not recorded, an order saved without its items, spots paid for and not sold, a guide that did not build. Somebody has to act, so this list should include whoever is running the shop.",
  },
  {
    key: "routine",
    title: "Everything else",
    body: "New orders, inquiries and transfer requests, and a game selling out.",
  },
] as const;

function Result({ state }: { state: { status: string; message?: string } }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`label mt-3 ${state.status === "error" ? "text-danger" : "text-acid"}`}
    >
      {state.message}
    </p>
  );
}

function TestButton({ group, disabled }: { group: "problems" | "routine"; disabled: boolean }) {
  const [state, action, pending] = useActionState(sendTestAlert, { status: "idle" as const });
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="group" value={group} />
      <button type="submit" disabled={disabled || pending} className="control control-sm">
        {pending ? "Sending…" : "Send a test"}
      </button>
      <Result state={state} />
    </form>
  );
}

export default function AlertRoutingForm({ routing }: { routing: AlertRouting }) {
  const [state, action, pending] = useActionState(saveAlertRouting, { status: "idle" as const });
  const owner = useIsOwner();

  return (
    <div>
      {!owner && <OwnerOnlyNote className="!mt-0 mb-6" />}
      <form action={action}>
        <fieldset disabled={!owner} className="space-y-10 disabled:opacity-60">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <label className="field-label" htmlFor={`alerts-${g.key}`}>
                {g.title}
              </label>
              <p className="mt-1 max-w-[60ch] text-sm text-muted">{g.body}</p>
              <textarea
                id={`alerts-${g.key}`}
                name={g.key}
                defaultValue={routing[g.key].join("\n")}
                placeholder="Empty: the script's usual address"
                rows={3}
                className="field-input mt-3 font-mono text-sm"
              />
            </div>
          ))}
          <div>
            <button type="submit" disabled={pending} className="cta-primary disabled:opacity-50">
              {pending ? "Saving…" : "Save recipients"}
            </button>
            <Result state={state} />
          </div>
        </fieldset>
      </form>

      <div className="mt-12 border-t hairline pt-8">
        <h3 className="label text-acid">Check it reaches people</h3>
        <p className="mt-2 max-w-[60ch] text-sm text-muted">
          Sends a test through the real script, marked as a test, and reports who
          the script says it went to. Save first: it uses the saved lists.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <p className="label text-muted">{g.title}</p>
              <TestButton group={g.key} disabled={!owner} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
