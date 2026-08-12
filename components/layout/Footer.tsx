import Link from "next/link";
import { LOGO_URL, SHOP_PHONE_DISPLAY, SHOP_PHONE_HREF } from "@/lib/brand";

const navLinks = [
  { href: "/inventory", label: "Inventory" },
  { href: "/featured", label: "Featured" },
  { href: "/transfers", label: "Transfers" },
  { href: "/services", label: "Services" },
  { href: "/visit", label: "Visit" },
];

export default function Footer() {
  return (
    <footer className="border-t hairline bg-surface">
      <div className="px-page grid gap-12 py-16 md:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="Molon Labe Firearms" className="h-[46px] w-auto" />
          <p className="mt-5 text-[13px] font-extrabold tracking-[-0.02em]">
            MLF × SCO
          </p>
          <p className="mt-2 max-w-[26ch] text-sm text-muted">
            A digital showroom. Everything here is sold in person, in the shop.
          </p>
          <a
            href="https://instagram.com/molonlabe.fa"
            target="_blank"
            rel="noopener noreferrer"
            className="label mt-6 inline-block text-muted transition-colors hover:text-acid"
          >
            @molonlabe.fa
          </a>
        </div>

        <div>
          <h2 className="label text-acid">Hours</h2>
          <dl className="mt-5 space-y-2 text-sm">
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
          <address className="mt-6 text-sm not-italic leading-relaxed text-muted">
            10024 Montana Ave
            <br />
            El Paso, TX
            <br />
            <a
              href={SHOP_PHONE_HREF}
              className="mt-2 inline-flex h-11 items-center text-bone underline underline-offset-4 hover:text-acid"
            >
              {SHOP_PHONE_DISPLAY}
            </a>
          </address>
        </div>

        <div>
          <h2 className="label text-acid">Navigation</h2>
          <ul className="mt-5 space-y-3">
            {navLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="label text-muted transition-colors hover:text-bone"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="label text-acid">Legal</h2>
          <ul className="mt-5 space-y-3 text-sm text-muted">
            <li>Sweepstakes rules — coming soon</li>
            <li>Privacy policy — coming soon</li>
            <li>Built by Purple Roots Agency</li>
          </ul>
        </div>
      </div>

      <div className="px-page border-t hairline py-6">
        <p className="max-w-4xl text-[11px] leading-relaxed text-muted">
          All firearm sales are conducted in person through a licensed dealer and
          are subject to federal, state, and local law, including all required
          background checks and waiting periods.
        </p>
        <p className="mt-3 text-[11px] text-muted">
          © {new Date().getFullYear()} Molon Labe Firearms x SunCity Outdoors
        </p>
      </div>
    </footer>
  );
}
