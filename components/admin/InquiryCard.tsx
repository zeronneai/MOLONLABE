"use client";

import { useTransition } from "react";
import { setInquiryStatus } from "@/app/admin/actions";
import type { Database } from "@/lib/database.types";

type Inquiry = Database["public"]["Tables"]["inquiries"]["Row"];
const STATUSES = ["new", "contacted", "closed"] as const;

export default function InquiryCard({
  inquiry,
  itemName,
}: {
  inquiry: Inquiry;
  itemName?: string;
}) {
  const [pending, start] = useTransition();
  const isNew = inquiry.status === "new";

  return (
    <div
      className={`border-b hairline py-5 ${isNew ? "border-l-2 border-l-acid pl-4" : ""} ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="display truncate text-lg">{inquiry.name.toUpperCase()}</p>
        <p className="label shrink-0 text-muted">
          {inquiry.created_at
            ? new Date(inquiry.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : ""}
        </p>
      </div>
      <p className="label mt-1 text-acid">
        {inquiry.type}
        {itemName ? ` · ${itemName}` : ""}
      </p>
      <p className="mt-2 text-sm text-muted">
        <a href={`mailto:${inquiry.email}`} className="underline underline-offset-4">
          {inquiry.email}
        </a>
        {inquiry.phone && (
          <>
            {" · "}
            <a href={`tel:${inquiry.phone}`} className="underline underline-offset-4">
              {inquiry.phone}
            </a>
          </>
        )}
      </p>
      {inquiry.message && (
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed">{inquiry.message}</p>
      )}

      <div className="mt-4 flex" role="group" aria-label="Inquiry status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={inquiry.status === s}
            onClick={() => start(() => setInquiryStatus(inquiry.id, s))}
            className={`label h-11 border px-4 transition-colors ${
              inquiry.status === s
                ? "border-acid text-acid"
                : "hairline text-muted hover:text-bone"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
