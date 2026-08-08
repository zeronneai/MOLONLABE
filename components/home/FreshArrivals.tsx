import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import EditorialIndex from "@/components/inventory/EditorialIndex";
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
        <div className="mt-12 border-t hairline py-16">
          <p className="label text-muted">
            The case is being stocked — come see us at 10024 Montana Ave.
          </p>
        </div>
      )}
    </section>
  );
}
