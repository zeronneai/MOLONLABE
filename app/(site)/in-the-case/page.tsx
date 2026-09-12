import type { Metadata } from "next";
import { getCaseItems, toIndexItem } from "@/lib/db/items";
import { getGameItemIds } from "@/lib/games/queries";
import InventoryBrowser from "@/components/inventory/InventoryBrowser";
import EmptyState from "@/components/ui/EmptyState";
import { IN_THE_CASE } from "@/content/en";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/in-the-case" },
  title: "In the case",
  description:
    "Firearms on hand right now at Molon Labe Firearms x SunCity Outdoors, El Paso, TX. Ask about any of them.",
};

export default async function InTheCasePage() {
  // A firearm in a game belongs on the Games surface for as long as
  // the game exists, and stays there as history once it is drawn. It is
  // not in the case any more — it has an owner.
  const inGames = await getGameItemIds();
  const items = await getCaseItems(inGames);

  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">In the case</p>
      {/* deliberate echo of the hero's payoff line — same constant */}
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
        {IN_THE_CASE}
      </h1>
      <p className="mt-6 max-w-[52ch] text-muted">
        Firearms on hand at the shop. These are not sold through the
        basket — every transfer goes through the counter, the background
        check and the paperwork. Ask about anything here and we will hold
        it for you.
      </p>

      {/* The editorial row layout stays here, and only here. It earns its
          keep on a short list of considered objects with real photography
          and specs; it would be the wrong shape for a grid of t-shirts. */}
      <div className="mt-14">
        {items.length > 0 ? (
          <InventoryBrowser items={items.map(toIndexItem)} />
        ) : (
          <EmptyState
            label="Empty case"
            headline="THE CASE IS EMPTY."
            body="Nothing is listed right now. Stock moves fast and this page only shows what is genuinely on hand — the counter is the fastest way to see what has just landed."
            action={{ href: "/visit", text: "Find us" }}
          />
        )}
      </div>
    </div>
  );
}
