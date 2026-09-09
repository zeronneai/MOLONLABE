"use client";

// Sizes, behind a toggle.
//
// The whole point of this component is that it is absent. Most of what
// this shop sells is one unit — a rifle, a used revolver, a single optic
// — and the form for those must not grow a stock table it will never use.
// So the toggle is off by default and nothing below it exists until it is
// on.
//
// Sizes are free text rather than a fixed S–XXL list. The moment you
// commit to a list you cannot stock a one-size hat, a 34 waist belt or a
// 9.5 boot.
//
// State is serialised into one hidden field. The server action gets a
// single value to parse instead of parallel arrays it has to zip back
// together by index — which is the usual way a row silently pairs with
// the wrong stock count.

import { useState } from "react";

export type VariantDraft = {
  /** Present for a size that already exists; absent for a new row. */
  id?: string;
  size: string;
  stock: number;
};

let seq = 0;
const nextKey = () => `new-${seq++}`;

export default function VariantEditor({
  initial,
  initialEnabled,
}: {
  initial: VariantDraft[];
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rows, setRows] = useState<(VariantDraft & { key: string })[]>(
    initial.map((v) => ({ ...v, key: v.id ?? nextKey() })),
  );

  const update = (key: string, patch: Partial<VariantDraft>) =>
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  // Rows with no size typed are dropped rather than saved as blanks: an
  // empty row is someone who clicked Add and changed their mind.
  const payload = rows
    .filter((r) => r.size.trim())
    .map((r) => ({
      id: r.id,
      size: r.size.trim(),
      stock: Number.isFinite(r.stock) ? Math.max(0, Math.floor(r.stock)) : 0,
    }));

  const duplicated = new Set(
    payload
      .map((r) => r.size.toLowerCase())
      .filter((s, i, all) => all.indexOf(s) !== i),
  );

  return (
    <div className="sm:col-span-2 border-t hairline pt-6">
      <input type="hidden" name="has_variants" value={enabled ? "on" : ""} />
      <input type="hidden" name="variants" value={JSON.stringify(payload)} />

      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => setEnabled((v) => !v)}
        className="control control-sm tone-acid"
      >
        This item comes in sizes
      </button>
      <p className="label mt-3 text-muted">
        Leave this off for anything sold as a single unit — a rifle, an
        optic, a used pistol. Turn it on for shirts, hats and anything else
        where the same product exists in more than one size.
      </p>

      {enabled && (
        <div className="mt-6">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] gap-2">
            <p className="label text-muted">Size</p>
            <p className="label text-muted">Stock</p>
            <span />
          </div>

          {rows.length === 0 && (
            <p className="mt-4 text-sm text-muted">
              No sizes yet. Add one below — until then this item cannot be
              bought, because there is no size to pick.
            </p>
          )}

          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-start gap-2"
              >
                <div className="min-w-0">
                  <input
                    value={row.size}
                    onChange={(e) => update(row.key, { size: e.target.value })}
                    placeholder="Medium, One size, 34…"
                    aria-label="Size"
                    className="field-input"
                  />
                </div>
                <input
                  type="number"
                  min={0}
                  value={row.stock}
                  onChange={(e) =>
                    update(row.key, { stock: Number(e.target.value) })
                  }
                  aria-label={`Stock for ${row.size || "this size"}`}
                  className="field-input"
                />
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => prev.filter((r) => r.key !== row.key))
                  }
                  aria-label={`Remove ${row.size || "this size"}`}
                  className="control control-sm control-danger !px-4"
                >
                  ✕
                </button>
                {duplicated.has(row.size.trim().toLowerCase()) && (
                  <p className="label col-span-3 text-danger">
                    Listed twice — the stock would be split
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setRows((prev) => [...prev, { key: nextKey(), size: "", stock: 0 }])
            }
            className="control control-sm mt-4"
          >
            Add a size
          </button>

          <p className="label mt-4 text-muted">
            Stock drops on its own as orders come in. Removing a size here
            takes it off sale; past orders keep it on their receipt.
          </p>
        </div>
      )}
    </div>
  );
}
