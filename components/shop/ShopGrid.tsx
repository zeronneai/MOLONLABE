import Image from "next/image";
import Link from "next/link";
import { formatUsd } from "@/lib/money";

// Apparel and accessories, as a grid.
//
// The inventory index is an editorial list because a rifle is a
// considered purchase — people read the specs, compare two, come back.
// A shirt is not that. Someone sees it, picks a size and pays, so the
// photograph does the work and the text stays out of the way.
//
// Still no cards. The rules belong to the cells themselves — a right and
// a bottom hairline each — so a part-filled last row leaves clean empty
// space rather than a slab of exposed background, which is what a
// gap-over-a-coloured-ground grid does when the item count is not a
// multiple of the column count.

export type ShopItem = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  priceCents: number | null;
  priceDisplay: string | null;
  image: string | null;
  soldOut: boolean;
};

export default function ShopGrid({ items }: { items: ShopItem[] }) {
  return (
    <div className="mt-12 grid grid-cols-2 border-t hairline sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/inventory/${item.slug}`}
          className="group block border-b border-r hairline p-4 sm:p-5"
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-surface">
            {item.image ? (
              <Image
                src={item.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className={`object-cover transition-opacity duration-200 ${
                  item.soldOut ? "opacity-35" : "group-hover:opacity-85"
                }`}
              />
            ) : (
              <span className="label absolute inset-0 grid place-items-center text-muted">
                No photo yet
              </span>
            )}

            {/* Sold out is stated, not hidden. Somebody who wanted that
                shirt should find out here rather than at the size picker. */}
            {item.soldOut && (
              <span className="label absolute bottom-0 left-0 bg-ink px-3 py-2 text-danger">
                Sold out
              </span>
            )}
          </div>

          <div className="mt-4">
            {item.brand && <p className="label text-muted">{item.brand}</p>}
            <p className="mt-1 font-extrabold tracking-[-0.02em] transition-colors group-hover:text-acid">
              {item.name}
            </p>
            <p className="mt-1 text-sm text-muted">
              {item.priceCents != null
                ? formatUsd(item.priceCents)
                : (item.priceDisplay ?? "Call for price")}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
