import Link from "next/link";

// Placeholder home. The full home page is build-order step 3 —
// this exists so the intro wipe reveals a real page underneath.
export default function Home() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="py-24 sm:py-36">
        <p className="label text-acid">El Paso, TX — 10024 Montana Ave</p>
        <h1 className="mt-6 text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-display leading-[0.95]">
          THE SHOP IS
          <br />
          THE SHOWROOM.
        </h1>
        <p className="mt-8 max-w-md text-muted">
          What you see here is on hand, in the case, right now. Come see it in
          person.
        </p>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/inventory"
            className="label bg-acid text-ink px-8 py-4 hover:bg-bone transition-colors"
          >
            View Inventory
          </Link>
          <Link
            href="/featured"
            className="label border hairline px-8 py-4 hover:border-acid hover:text-acid transition-colors"
          >
            Current Feature
          </Link>
        </div>
      </div>
    </section>
  );
}
