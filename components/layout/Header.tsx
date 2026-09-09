"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_URL } from "@/lib/brand";
import { SHOP_PHONE_HREF } from "@/lib/brand";
import CartLink from "@/components/cart/CartLink";

const nav = [
  { href: "/inventory", label: "Inventory" },
  { href: "/shop", label: "Shop" },
  { href: "/featured", label: "Featured" },
  { href: "/transfers", label: "Transfers" },
  { href: "/services", label: "Services" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 h-[72px] transition-colors duration-300 ${
        scrolled ? "bg-[rgba(11,10,12,0.92)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="px-page flex h-full items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="" className="h-[30px] w-auto" />
          <span className="text-[13px] font-extrabold tracking-[-0.02em]">
            MLF × SCO
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <nav aria-label="Primary">
            <ul className="flex items-center gap-8">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`label transition-colors hover:text-bone ${
                      pathname.startsWith(item.href) ? "text-acid" : "text-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <CartLink />
          <Link
            href="/visit"
            className="control control-sm"
          >
            Visit
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="md:hidden flex h-11 w-11 flex-col items-end justify-center gap-1.5"
        >
          <span className="block h-px w-6 bg-bone" />
          <span className="block h-px w-4 bg-bone" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink flex flex-col md:hidden">
          <div className="px-page flex h-[72px] shrink-0 items-center justify-between">
            <span className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt="" className="h-[30px] w-auto" />
              <span className="text-[13px] font-extrabold tracking-[-0.02em]">
                MLF × SCO
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="label flex h-11 min-w-11 items-center justify-center text-muted"
            >
              Close
            </button>
          </div>
          <nav aria-label="Menu" className="px-page mt-6 flex-1 overflow-y-auto">
            <ul>
              {[{ href: "/", label: "Home" }, ...nav, { href: "/visit", label: "Visit" }].map(
                (item) => (
                  <li key={item.href} className="border-b hairline">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="display block py-5 text-4xl"
                    >
                      {item.label.toUpperCase()}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
          <div className="px-page pb-10 pt-6">
            <div className="mb-6">
              <CartLink onNavigate={() => setOpen(false)} />
            </div>
            <p className="label text-muted">Mon–Fri 11–19 · Sat 11–18 · Sun 11–17</p>
            <a href={SHOP_PHONE_HREF} className="cta-primary mt-6 w-full">
              Call the shop
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
