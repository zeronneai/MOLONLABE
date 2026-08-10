"use client";

// One inventory row in the admin: single-tap status + featured toggles,
// reorder, edit, duplicate — usable one-handed on a phone.

import { useTransition } from "react";
import Link from "next/link";
import {
  duplicateItem,
  moveItem,
  setItemStatus,
  toggleItemFeatured,
} from "@/app/admin/actions";
import { ITEM_STATUSES } from "@/lib/admin/constants";
import type { ItemRow } from "@/lib/database.types";

export default function ItemAdminCard({ item }: { item: ItemRow }) {
  const [pending, start] = useTransition();
  const image = Array.isArray(item.images)
    ? (item.images.find((u) => typeof u === "string") as string | undefined)
    : undefined;

  return (
    <div
      className={`border-b hairline py-5 transition-opacity ${pending ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-4">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-14 w-14 shrink-0 object-cover" />
        ) : (
          <div className="h-14 w-14 shrink-0 bg-surface-2" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="display truncate text-lg">{item.name.toUpperCase()}</p>
            <button
              type="button"
              aria-label="Toggle featured"
              aria-pressed={item.is_featured ?? false}
              onClick={() => start(() => toggleItemFeatured(item.id, !item.is_featured))}
              className={`flex h-11 w-11 shrink-0 items-center justify-center text-xl ${
                item.is_featured ? "text-acid" : "text-muted"
              }`}
            >
              {item.is_featured ? "★" : "☆"}
            </button>
          </div>
          <p className="label mt-1 text-muted">
            {item.category} · {item.price_display ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="flex" role="group" aria-label="Status">
          {ITEM_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={item.status === s}
              onClick={() => start(() => setItemStatus(item.id, s))}
              className={`label h-11 border px-3 transition-colors ${
                item.status === s
                  ? s === "sold"
                    ? "border-danger text-danger"
                    : s === "hidden"
                      ? "border-muted text-bone"
                      : "border-acid text-acid"
                  : "hairline text-muted hover:text-bone"
              }`}
            >
              {s === "available" ? "Avail" : s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            aria-label="Move up"
            onClick={() => start(() => moveItem(item.id, "up"))}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-bone"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            onClick={() => start(() => moveItem(item.id, "down"))}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-bone"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => start(() => duplicateItem(item.id))}
            className="label h-11 px-3 text-muted hover:text-bone"
          >
            Dup
          </button>
          <Link
            href={`/admin/inventory/${item.id}`}
            className="label flex h-11 items-center border hairline px-4 text-bone hover:border-acid hover:text-acid"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
