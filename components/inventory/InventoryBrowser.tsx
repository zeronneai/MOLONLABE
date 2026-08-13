"use client";

// Filter row + editorial index. Filters are plain text labels; switching
// animates the visible rows out (150ms) and the next set in with a 25ms
// stagger per row.

import { useRef, useState } from "react";
import EditorialIndex, { type IndexItem } from "./EditorialIndex";
import EmptyState from "@/components/ui/EmptyState";

const FILTERS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Pistol", value: "pistol" },
  { label: "Revolver", value: "revolver" },
  { label: "Rifle", value: "rifle" },
  { label: "PCC", value: "pcc" },
  { label: "Optics", value: "optic" },
];

export default function InventoryBrowser({ items }: { items: IndexItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const [gen, setGen] = useState(0);
  const pending = useRef<number>(0);

  const applyFilter = (value: string | null) => {
    if (value === active || exiting) return;
    window.clearTimeout(pending.current);
    setExiting(true);
    pending.current = window.setTimeout(() => {
      setActive(value);
      setGen((g) => g + 1);
      setExiting(false);
    }, 170);
  };

  const filtered = active
    ? items.filter((i) => i.categoryKey === active)
    : items;

  return (
    <div>
      <div
        role="group"
        aria-label="Filter by category"
        className="flex flex-wrap gap-x-8 gap-y-3"
      >
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={active === f.value}
            onClick={() => applyFilter(f.value)}
            className="filter-label"
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-10">
        {filtered.length > 0 ? (
          <EditorialIndex items={filtered} enterKey={gen} exiting={exiting} />
        ) : (
          <EmptyState
            label={active === "all" ? "Empty case" : "Nothing in this category"}
            headline={
              active === "all" ? "THE CASE IS EMPTY." : "NOTHING HERE RIGHT NOW."
            }
            body="Stock moves fast and the site only shows what's actually on hand. Call the shop — what's coming in isn't listed yet."
            action={{ href: "/visit", text: "Find us" }}
          />
        )}
      </div>
    </div>
  );
}
