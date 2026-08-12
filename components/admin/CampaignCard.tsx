"use client";

import { useTransition } from "react";
import Link from "next/link";
import { setCampaignStatus } from "@/app/admin/actions";
import { CAMPAIGN_STATUSES } from "@/lib/admin/constants";
import type { CampaignRow } from "@/lib/database.types";

const CAMPAIGN_TONE: Record<string, string> = {
  live: "tone-acid",
  awarded: "tone-caution",
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export default function CampaignCard({
  campaign,
  itemName,
  entries,
}: {
  campaign: CampaignRow;
  itemName?: string;
  entries: number;
}) {
  const [pending, start] = useTransition();

  return (
    <div className={`border-b hairline py-5 ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="display truncate text-lg">{campaign.title.toUpperCase()}</p>
          <p className="label mt-1 text-muted">
            {itemName ?? "No item"} · {fmt(campaign.opens_at)} → {fmt(campaign.closes_at)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="display text-2xl tabular-nums">{entries}</p>
          <p className="label text-muted">Entries</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="seg" role="group" aria-label="Campaign status">
          {CAMPAIGN_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={campaign.status === s}
              onClick={() => start(() => setCampaignStatus(campaign.id, s))}
              className={`control control-sm ${CAMPAIGN_TONE[s] ?? ""}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/admin/entrants/export?campaign=${campaign.id}`}
            className="label flex h-11 items-center px-3 text-muted hover:text-bone"
          >
            CSV
          </a>
          <Link
            href={`/admin/featured/${campaign.id}`}
            className="control control-sm ml-2"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
