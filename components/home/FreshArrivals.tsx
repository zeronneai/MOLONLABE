import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import EditorialIndex from "@/components/inventory/EditorialIndex";
import EmptyState from "@/components/ui/EmptyState";
import { getFreshArrivals, toIndexItem } from "@/lib/db/items";

export default async function FreshArrivals() {
  const items = await getFreshArrivals();

  return (
    <section className="px-page py-24">
      <Reveal>
        <p className="label text-acid">Fresh Arrivals</p>
        <h2 className="display mt-6 max-w-3xl text-[clamp(2rem,4vw,3.5rem)]">
          NEWEST IN THE CASE
        </h2>
      </Reveal>
      {items.length > 0 ? (
        <>
          <Reveal delay={60} className="mt-12">
            <EditorialIndex items={items.map(toIndexItem)} />
          </Reveal>
          <div className="mt-10">
            <Link href="/inventory" className="cta-secondary">
              View all inventory →
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-12">
          <EmptyState
            label="Being stocked"
            headline="THE CASE IS BEING FILLED."
            body="Nothing is listed yet. What's on hand goes up here as it lands — until then, the counter is the fastest way to see it."
            action={{ href: "/visit", text: "Find us" }}
          />
        </div>
      )}
    </section>
  );
}
