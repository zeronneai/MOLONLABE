"use client";

import { useActionState } from "react";
import { saveCampaign } from "@/app/admin/actions";
import type { CampaignRow } from "@/lib/database.types";

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CampaignForm({
  campaign,
  items,
}: {
  campaign?: CampaignRow;
  items: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveCampaign, {
    status: "idle" as const,
  });

  return (
    <form action={action} className="max-w-2xl">
      {campaign && <input type="hidden" name="id" value={campaign.id} />}

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="c-title">Title</label>
          <input id="c-title" name="title" defaultValue={campaign?.title} className="field-input" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="c-item">Prize item</label>
          <select
            id="c-item"
            name="item_id"
            defaultValue={campaign?.item_id ?? ""}
            className="field-input"
          >
            <option value="" className="bg-surface text-bone">
              — none —
            </option>
            {items.map((i) => (
              <option key={i.id} value={i.id} className="bg-surface text-bone">
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="c-desc">Description</label>
          <textarea
            id="c-desc"
            name="description"
            defaultValue={campaign?.description ?? ""}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="c-opens">Opens</label>
          <input
            id="c-opens"
            name="opens_at"
            type="datetime-local"
            defaultValue={toLocal(campaign?.opens_at ?? null)}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="c-closes">Closes</label>
          <input
            id="c-closes"
            name="closes_at"
            type="datetime-local"
            defaultValue={toLocal(campaign?.closes_at ?? null)}
            className="field-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="c-winner">Winner note</label>
          <input
            id="c-winner"
            name="winner_note"
            defaultValue={campaign?.winner_note ?? ""}
            className="field-input"
          />
        </div>
      </div>

      {state.status === "error" && (
        <p aria-live="polite" className="mt-6 text-[11px] uppercase tracking-[0.18em] text-danger">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="cta-primary control-go mt-10 w-full sm:w-auto">
        {pending ? "Saving…" : campaign ? "Save changes" : "Create campaign"}
      </button>
    </form>
  );
}
