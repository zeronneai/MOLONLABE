import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-page flex min-h-svh flex-col justify-center pb-24 pt-[72px]">
      <p className="label text-acid">404</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
        NOT IN
        <br />
        THE CASE.
      </h1>
      <p className="mt-6 max-w-md text-muted">
        Whatever was here is gone, sold, or never existed. Inventory moves
        fast around here.
      </p>
      <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4">
        <Link href="/inventory" className="cta-primary">
          View inventory
        </Link>
        <Link href="/" className="cta-secondary">
          Back home
        </Link>
      </div>
    </div>
  );
}
