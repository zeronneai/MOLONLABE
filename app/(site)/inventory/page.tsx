import type { Metadata } from "next";
import { getVisibleItems, toIndexItem } from "@/lib/db/items";
import InventoryBrowser from "@/components/inventory/InventoryBrowser";
import EmptyState from "@/components/ui/EmptyState";
import { IN_THE_CASE } from "@/content/en";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/inventory" },
  title: "Inventory",
  description:
    "What is on hand right now at Molon Labe Firearms x SunCity Outdoors, El Paso, TX.",
};

export default async function InventoryPage() {
  const items = await getVisibleItems();

  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Inventory</p>
      {/* deliberate echo of the hero's payoff line — same constant */}
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
        {IN_THE_CASE}
      </h1>
      <p className="mt-6 max-w-md text-muted">
        Everything listed is on hand at the shop. Status is live — when it
        says available, it is in the case right now.
      </p>

      <div className="mt-14">
        {items.length > 0 ? (
          <InventoryBrowser items={items.map(toIndexItem)} />
        ) : (
          <EmptyState
            label="Empty case"
            headline="THE CASE IS EMPTY."
            body="Nothing is listed right now. Stock moves fast and this page only shows what's genuinely on hand — the counter is the fastest way to see what's just landed."
            action={{ href: "/visit", text: "Find us" }}
          />
        )}
      </div>
    </div>
  );
}
