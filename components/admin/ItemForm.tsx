"use client";

import { useActionState, useState } from "react";
import { saveItem } from "@/app/admin/actions";
import {
  CATEGORIES,
  ITEM_STATUSES,
  defaultFulfillment,
} from "@/lib/admin/constants";
import type { ItemRow } from "@/lib/database.types";
import ImageUploader from "./ImageUploader";
import VariantEditor, { type VariantDraft } from "./VariantEditor";

const stamp = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Denver",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : null;

export default function ItemForm({
  item,
  variants = [],
}: {
  item?: ItemRow;
  variants?: VariantDraft[];
}) {
  const [state, action, pending] = useActionState(saveItem, { status: "idle" as const });
  const initialSpecs =
    item?.specs && typeof item.specs === "object" && !Array.isArray(item.specs)
      ? Object.entries(item.specs).map(([k, v]) => [k, String(v)] as [string, string])
      : [];
  const [specs, setSpecs] = useState<[string, string][]>(
    initialSpecs.length ? initialSpecs : [["", ""]],
  );
  // Category drives the fulfilment default, but only until the owner
  // touches it. Apparel always ships; everything else stays on the
  // cautious side, because the wrong guess in that direction is a firearm
  // in the mail.
  const [category, setCategory] = useState(item?.category ?? "pistol");
  const [fulfillment, setFulfillment] = useState<"ship" | "pickup">(
    item
      ? item.fulfillment_type === "ship"
        ? "ship"
        : "pickup"
      : // A new item starts on the category the select starts on.
        defaultFulfillment("pistol"),
  );
  const [fulfillmentTouched, setFulfillmentTouched] = useState(Boolean(item));

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
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (!fulfillmentTouched) setFulfillment(defaultFulfillment(e.target.value));
            }}
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
        <div>
          <label className="field-label" htmlFor="f-price-cents">
            Online price{" "}
            <span className="normal-case tracking-normal">(blank = not sold online)</span>
          </label>
          <input
            id="f-price-cents"
            name="price_online"
            inputMode="decimal"
            placeholder="1299.00"
            defaultValue={
              item?.price_cents != null ? (item.price_cents / 100).toFixed(2) : ""
            }
            className="field-input"
          />
          <p className="label mt-2 text-muted">
            Leave blank and the item shows its display price and cannot be
            added to a cart.
          </p>
        </div>

        {/* Legal, not cosmetic: this decides whether the item can be put
            in the post. It defaults to collect-in-store so a forgotten
            field can never make a firearm shippable. */}
        <div className="sm:col-span-2">
          <p className="field-label">How it reaches the buyer</p>
          <div className="seg mt-2">
            <label className="control control-sm has-[:checked]:!bg-surface-sunken has-[:checked]:!border-amber has-[:checked]:!text-amber">
              <input
                type="radio"
                name="fulfillment_type"
                value="pickup"
                checked={fulfillment === "pickup"}
                onChange={() => {
                  setFulfillment("pickup");
                  setFulfillmentTouched(true);
                }}
                className="sr-only"
              />
              Collect in store
            </label>
            <label className="control control-sm has-[:checked]:!bg-surface-sunken has-[:checked]:!border-muted has-[:checked]:!text-bone">
              <input
                type="radio"
                name="fulfillment_type"
                value="ship"
                checked={fulfillment === "ship"}
                onChange={() => {
                  setFulfillment("ship");
                  setFulfillmentTouched(true);
                }}
                className="sr-only"
              />
              Ships
            </label>
          </div>
          <p className="label mt-2 text-muted">
            Firearms are collected in store. Optics, holsters and apparel
            ship. Ammunition depends on where it is going — set it per item.
          </p>
        </div>

        {/* Only asked when the thing is actually posted. A collected
            firearm has no postage tier, and offering one would imply it
            might be shipped. */}
        {fulfillment === "ship" && (
          <div className="sm:col-span-2">
            <p className="field-label">Postage tier</p>
            <div className="seg mt-2">
              <label className="control control-sm has-[:checked]:!bg-surface-sunken has-[:checked]:!border-muted has-[:checked]:!text-bone">
                <input
                  type="radio"
                  name="shipping_tier"
                  value="standard"
                  defaultChecked={(item?.shipping_tier ?? "standard") !== "oversize"}
                  className="sr-only"
                />
                Standard
              </label>
              <label className="control control-sm has-[:checked]:!bg-surface-sunken has-[:checked]:!border-amber has-[:checked]:!text-amber">
                <input
                  type="radio"
                  name="shipping_tier"
                  value="oversize"
                  defaultChecked={item?.shipping_tier === "oversize"}
                  className="sr-only"
                />
                Oversize
              </label>
            </div>
            <p className="label mt-2 text-muted">
              Standard is apparel and small accessories. Oversize is bulky
              gear — cases, safes, anything that needs its own box. Rates are
              set under Tax &amp; Shipping.
            </p>
          </div>
        )}

        <VariantEditor initial={variants} initialEnabled={Boolean(item?.has_variants)} />

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
              className="control control-danger !h-14 !px-4"
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

      <button type="submit" disabled={pending} className="cta-primary control-go mt-10 w-full sm:w-auto">
        {pending ? "Saving…" : item ? "Save changes" : "Add item"}
      </button>

      {/* Who touched this, quietly. Two people work in here and until now
          there was no way to tell which of them changed a price. Names,
          never email addresses, and never rendered outside the admin. */}
      {item && (
        <div className="mt-12 border-t hairline pt-5">
          <dl className="space-y-1">
            <div className="flex flex-wrap gap-x-2">
              <dt className="label text-muted">Added</dt>
              <dd className="label text-muted">
                {item.created_by_name ?? "before this was tracked"}
                {stamp(item.created_at) ? ` · ${stamp(item.created_at)}` : ""}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="label text-muted">Last edited</dt>
              <dd className="label text-muted">
                {item.updated_by_name ?? "before this was tracked"}
                {stamp(item.updated_at) ? ` · ${stamp(item.updated_at)}` : ""}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </form>
  );
}
