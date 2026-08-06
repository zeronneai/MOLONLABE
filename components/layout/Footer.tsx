import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t hairline bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="text-xl font-extrabold tracking-display">
              MOLON LABE <span className="text-acid">✕</span> SUNCITY OUTDOORS
            </p>
            <p className="mt-3 text-sm text-muted max-w-xs">
              A digital showroom. Everything you see here is sold in person, in
              the shop.
            </p>
            <p className="mt-6">
              <a
                href="https://instagram.com/molonlabe.fa"
                target="_blank"
                rel="noopener noreferrer"
                className="label text-muted hover:text-acid transition-colors"
              >
                Instagram — @molonlabe.fa
              </a>
            </p>
          </div>

          <div>
            <h2 className="label text-acid">Hours</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-6 border-b hairline pb-2">
                <dt className="text-muted">Mon – Fri</dt>
                <dd>11:00 – 19:00</dd>
              </div>
              <div className="flex justify-between gap-6 border-b hairline pb-2">
                <dt className="text-muted">Saturday</dt>
                <dd>11:00 – 18:00</dd>
              </div>
              <div className="flex justify-between gap-6 border-b hairline pb-2">
                <dt className="text-muted">Sunday</dt>
                <dd>11:00 – 17:00</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="label text-acid">Visit</h2>
            <address className="mt-4 text-sm not-italic leading-relaxed">
              10024 Montana Ave
              <br />
              El Paso, TX
            </address>
            <p className="mt-4">
              <Link
                href="/visit"
                className="label text-muted hover:text-bone transition-colors"
              >
                Directions →
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-12 border-t hairline pt-6">
          <p className="text-xs text-muted leading-relaxed max-w-3xl">
            All firearm sales are conducted in person through a licensed dealer
            and are subject to federal, state, and local law, including all
            required background checks and waiting periods.
          </p>
          <p className="mt-4 text-xs text-muted">
            © {new Date().getFullYear()} Molon Labe Firearms x SunCity Outdoors
            · Built by Purple Roots Agency
          </p>
        </div>
      </div>
    </footer>
  );
}
