"use client";

import { useMemo, useState } from "react";
import ShopGrid, { type ShopItem } from "./ShopGrid";

/**
 * Category filtering over the shop grid.
 *
 * Client-side, because the whole shop is a few dozen items and a round
 * trip per tap would be slower than the filter is worth. If it ever grows
 * past a few hundred this becomes a query parameter and a server filter;
 * it is not there yet and pretending otherwise would cost a page load per
 * tap today.
 *
 * Only categories that actually have stock get a tab. A filter that leads
 * to an empty result is a dead end the visitor had no way to predict.
 */
export default function ShopBrowser({
  items,
}: {
  items: (ShopItem & { category: string })[];
}) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const [active, setActive] = useState<string | null>(null);
  const shown = active ? items.filter((i) => i.category === active) : items;

  // One category is not a choice. Showing a lone tab next to "All" implies
  // there is somewhere else to go.
  if (categories.length < 2) return <ShopGrid items={items} />;

  return (
    <>
      <div
        className="mt-10 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by category"
      >
        <button
          type="button"
          onClick={() => setActive(null)}
          aria-pressed={active === null}
          className={`control control-sm ${
            active === null ? "!border-acid !text-acid" : ""
          }`}
        >
          All <span className="text-muted">{items.length}</span>
        </button>
        {categories.map(([category, count]) => (
          <button
            key={category}
            type="button"
            onClick={() => setActive(category)}
            aria-pressed={active === category}
            className={`control control-sm ${
              active === category ? "!border-acid !text-acid" : ""
            }`}
          >
            {category} <span className="text-muted">{count}</span>
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {shown.length} {shown.length === 1 ? "item" : "items"} shown
      </p>

      <ShopGrid items={shown} />
    </>
  );
}
