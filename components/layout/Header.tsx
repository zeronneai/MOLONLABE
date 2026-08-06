import Link from "next/link";

const nav = [
  { href: "/inventory", label: "Inventory" },
  { href: "/featured", label: "Featured" },
  { href: "/transfers", label: "Transfers" },
  { href: "/services", label: "Services" },
  { href: "/visit", label: "Visit" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-ink/95 backdrop-blur-sm border-b hairline">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            {/* Swap for /brand/logo-skull.png when the client asset lands */}
            <span
              aria-hidden
              className="block h-8 w-8 border-2 border-acid"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-acid-dim) 0%, var(--color-ink) 60%)",
              }}
            />
            <span className="leading-none">
              <span className="block text-sm font-extrabold tracking-display">
                MOLON LABE
              </span>
              <span className="block text-[0.5625rem] font-semibold uppercase tracking-label text-muted mt-0.5">
                SunCity Outdoors
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-8">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="label text-muted hover:text-bone transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <a
            href="tel:+19150000000"
            className="label border hairline px-4 py-2.5 text-bone hover:border-acid hover:text-acid transition-colors shrink-0"
          >
            Call
          </a>
        </div>

        {/* Compact nav row on mobile */}
        <nav aria-label="Primary mobile" className="md:hidden -mx-4 px-4 pb-3 overflow-x-auto">
          <ul className="flex items-center gap-6 whitespace-nowrap">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="label text-muted hover:text-bone transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
