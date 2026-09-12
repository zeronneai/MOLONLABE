import type { Metadata } from "next";
import type { ShopItem } from "@/components/shop/ShopGrid";
import ShopBrowser from "@/components/shop/ShopBrowser";
import EmptyState from "@/components/ui/EmptyState";
import Reveal from "@/components/motion/Reveal";
import { getShopItems, getSoldOutItemIds, itemImages } from "@/lib/db/items";
import { SHOP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Shop",
  description:
    `Apparel, accessories, ammunition and optics from ${SHOP_NAME}. Priced, in stock, ready to buy.`,
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

  const items: (ShopItem & { category: string })[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    category: row.category,
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
        PICK IT
        <br />
        UP.
      </h1>
      <p className="mt-8 max-w-[56ch] text-muted">
        Apparel, accessories, ammunition and glass. Everything here has a
        price and goes in the basket — firearms do not, and are{" "}
        <a href="/in-the-case" className="underline hover:text-acid">
          in the case
        </a>{" "}
        instead.
      </p>

      {items.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            label="Shop"
            headline="Nothing here yet"
            body="Nothing is priced for sale yet. In the meantime, the case is worth a look."
            action={{ href: "/in-the-case", text: "See the case" }}
          />
        </div>
      ) : (
        <Reveal>
          <ShopBrowser items={items} />
        </Reveal>
      )}
    </div>
  );
}
