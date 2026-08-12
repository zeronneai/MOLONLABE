"use client";

// One inventory row in the admin: single-tap status + featured toggles,
// reorder, edit, duplicate — usable one-handed on a phone.

import { useTransition } from "react";
import Link from "next/link";
import {
  archiveItem,
  duplicateItem,
  moveItem,
  restoreItem,
  setItemStatus,
  toggleItemFeatured,
} from "@/app/admin/actions";
import { showToast } from "@/components/admin/Toast";
import { ARCHIVED_STATUS, ITEM_LIVE_STATUSES } from "@/lib/admin/constants";
import type { ItemRow } from "@/lib/database.types";

// One meaning per colour: go, caution, destructive.
const STATUS_TONE: Record<string, string> = {
  available: "tone-acid",
  reserved: "tone-caution",
  sold: "tone-danger",
};

export default function ItemAdminCard({ item }: { item: ItemRow }) {
  const [pending, start] = useTransition();
  const archived = item.status === ARCHIVED_STATUS;
  const image = Array.isArray(item.images)
    ? (item.images.find((u) => typeof u === "string") as string | undefined)
    : undefined;

  // Applied immediately, no confirm — the toast carries the way back.
  const archive = () =>
    start(async () => {
      const previous = await archiveItem(item.id);
      showToast({
        message: "Archived.",
        actionLabel: "Undo",
        onAction: () => restoreItem(item.id, previous ?? "available"),
      });
    });

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
            {archived && <span className="text-bone">Archived · </span>}
            {item.category} · {item.price_display ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
        {archived ? (
          <button
            type="button"
            onClick={() => start(() => restoreItem(item.id, "available"))}
            className="control control-sm"
          >
            Restore
          </button>
        ) : (
          // The depressed segment carries its status colour, so the state
          // reads without parsing the label.
          <div className="seg" role="group" aria-label="Status">
            {ITEM_LIVE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={item.status === s}
                onClick={() => start(() => setItemStatus(item.id, s))}
                className={`control control-sm ${STATUS_TONE[s]}`}
              >
                {s === "available" ? "Avail" : s}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="seg">
            <button
              type="button"
              aria-label="Move up"
              onClick={() => start(() => moveItem(item.id, "up"))}
              className="control control-sm !px-3"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              onClick={() => start(() => moveItem(item.id, "down"))}
              className="control control-sm !px-3"
            >
              ↓
            </button>
          </div>
          <button
            type="button"
            onClick={() => start(() => duplicateItem(item.id))}
            className="control control-sm"
          >
            Dup
          </button>
          {!archived && (
            <button type="button" onClick={archive} className="control control-sm">
              Archive
            </button>
          )}
          <Link
            href={`/admin/inventory/${item.id}`}
            className="control control-sm"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
