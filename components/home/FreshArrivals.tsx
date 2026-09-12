import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import EditorialIndex from "@/components/inventory/EditorialIndex";
import EmptyState from "@/components/ui/EmptyState";
import { getFreshArrivals, toIndexItem } from "@/lib/db/items";

export default async function FreshArrivals() {
  const items = await getFreshArrivals();

  return (
    <section className="ground-ink">
      <div className="px-page py-24">
      <Reveal>
        <p className="label text-acid">Fresh arrivals</p>
        <h2 className="display mt-6 max-w-3xl text-[clamp(2rem,4vw,3.5rem)]">
          NEWEST IN THE SHOP
        </h2>
        <p className="mt-6 max-w-[50ch] text-muted">
          Two of the newest things you can buy outright. The rest are in
          the shop.
        </p>
      </Reveal>
      {items.length > 0 ? (
        <>
          <Reveal delay={60} className="mt-12">
            <EditorialIndex items={items.map(toIndexItem)} />
          </Reveal>
          <div className="mt-10">
            <Link href="/shop" className="cta-secondary">
              Everything in the shop →
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-12">
          <EmptyState
            label="Being stocked"
            headline="THE SHELVES ARE BEING FILLED."
            body="Nothing is priced for sale yet. Anything with a price lands here as it goes up — until then, the counter is the fastest way to see what is in."
            action={{ href: "/visit", text: "Find us" }}
          />
        </div>
      )}
      </div>
    </section>
  );
}
