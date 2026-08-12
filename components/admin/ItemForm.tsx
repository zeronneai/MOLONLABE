"use client";

import { useActionState, useState } from "react";
import { saveItem } from "@/app/admin/actions";
import { CATEGORIES, ITEM_STATUSES } from "@/lib/admin/constants";
import type { ItemRow } from "@/lib/database.types";
import ImageUploader from "./ImageUploader";

export default function ItemForm({ item }: { item?: ItemRow }) {
  const [state, action, pending] = useActionState(saveItem, { status: "idle" as const });
  const initialSpecs =
    item?.specs && typeof item.specs === "object" && !Array.isArray(item.specs)
      ? Object.entries(item.specs).map(([k, v]) => [k, String(v)] as [string, string])
      : [];
  const [specs, setSpecs] = useState<[string, string][]>(
    initialSpecs.length ? initialSpecs : [["", ""]],
  );
  const images =
    item && Array.isArray(item.images)
      ? item.images.filter((u): u is string => typeof u === "string")
      : [];

  return (
    <form action={action} className="max-w-2xl">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="f-name">Name</label>
          <input id="f-name" name="name" defaultValue={item?.name} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="f-category">Category</label>
          <select
            id="f-category"
            name="category"
            defaultValue={item?.category ?? "pistol"}
            className="field-input"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-surface text-bone">
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="f-status">Status</label>
          <select
            id="f-status"
            name="status"
            defaultValue={item?.status ?? "available"}
            className="field-input"
          >
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-surface text-bone">
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="f-brand">Brand</label>
          <input id="f-brand" name="brand" defaultValue={item?.brand ?? ""} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="f-price">Price display</label>
          <input
            id="f-price"
            name="price_display"
            defaultValue={item?.price_display ?? "Call for price"}
            className="field-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="f-slug">
            Slug <span className="normal-case tracking-normal">(blank = from name)</span>
          </label>
          <input id="f-slug" name="slug" defaultValue={item?.slug} className="field-input" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="f-short">Short description</label>
          <input
            id="f-short"
            name="short_desc"
            defaultValue={item?.short_desc ?? ""}
            className="field-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="f-long">Long description</label>
          <textarea
            id="f-long"
            name="long_desc"
            defaultValue={item?.long_desc ?? ""}
            className="field-input"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="f-video">Video URL</label>
          <input
            id="f-video"
            name="video_url"
            defaultValue={item?.video_url ?? ""}
            className="field-input"
          />
        </div>
      </div>

      <div className="mt-10">
        <p className="field-label">Photos</p>
        <div className="mt-4">
          <ImageUploader initial={images} />
        </div>
      </div>

      <div className="mt-10">
        <p className="field-label">Specs</p>
        {specs.map(([k, v], i) => (
          <div key={i} className="mt-2 flex gap-3">
            <input
              name="spec_key"
              defaultValue={k}
              placeholder="Caliber"
              aria-label="Spec name"
              className="field-input flex-1"
            />
            <input
              name="spec_val"
              defaultValue={v}
              placeholder="9mm"
              aria-label="Spec value"
              className="field-input flex-1"
            />
            <button
              type="button"
              aria-label="Remove spec"
              onClick={() => setSpecs((s) => s.filter((_, j) => j !== i))}
              className="flex h-14 w-11 items-center justify-center text-danger"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSpecs((s) => [...s, ["", ""]])}
          className="label mt-2 flex h-11 items-center text-muted hover:text-bone"
        >
          + Add spec
        </button>
      </div>

      <label className="mt-10 flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="is_featured"
          defaultChecked={item?.is_featured ?? false}
          className="h-5 w-5 accent-[#57b94a]"
        />
        <span className="label text-muted">Featured slot</span>
      </label>

      {state.status === "error" && (
        <p aria-live="polite" className="mt-6 text-[11px] uppercase tracking-[0.18em] text-danger">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="cta-primary mt-10 w-full sm:w-auto disabled:opacity-50">
        {pending ? "Saving…" : item ? "Save changes" : "Add item"}
      </button>
    </form>
  );
}
