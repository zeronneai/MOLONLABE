import type { Metadata } from "next";
import { getVisibleItems, toIndexItem } from "@/lib/db/items";
import InventoryBrowser from "@/components/inventory/InventoryBrowser";
import { IN_THE_CASE } from "@/content/en";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory — Molon Labe Firearms x SunCity Outdoors",
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
          <div className="border-t hairline py-20">
            <p className="label text-muted">
              The case is being stocked — check back shortly, or come see us
              at 10024 Montana Ave.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
