import type { Metadata } from "next";
import ShopGrid, { type ShopItem } from "@/components/shop/ShopGrid";
import EmptyState from "@/components/ui/EmptyState";
import Reveal from "@/components/motion/Reveal";
import { getShopItems, getSoldOutItemIds, itemImages } from "@/lib/db/items";
import { SHOP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Shop",
  description:
    `Apparel and accessories from ${SHOP_NAME}. Everything here ships — no transfer, no paperwork.`,
  alternates: { canonical: "/shop" },
};

export const revalidate = 300;

export default async function ShopPage() {
  const rows = await getShopItems();
  // Only sized items can be sold out this way; a one-off accessory is
  // governed by its status instead.
  const soldOut = await getSoldOutItemIds(
    rows.filter((r) => r.has_variants).map((r) => r.id),
  );

  const items: ShopItem[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    priceCents: row.price_cents,
    priceDisplay: row.price_display,
    image: itemImages(row)[0] ?? null,
    soldOut: soldOut.has(row.id) || row.status === "sold",
  }));

  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Shop</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
        WEAR IT
        <br />
        OUT.
      </h1>
      <p className="mt-8 max-w-[56ch] text-muted">
        Shirts, hats and the small stuff. This is the part of the catalogue
        that just ships — no transfer, no paperwork, no trip to the counter
        unless you want one.
      </p>

      {items.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            label="Shop"
            headline="Nothing here yet"
            body="Apparel is on its way. In the meantime, the case is worth a look."
            action={{ href: "/inventory", text: "View inventory" }}
          />
        </div>
      ) : (
        <Reveal>
          <ShopGrid items={items} />
        </Reveal>
      )}
    </div>
  );
}
