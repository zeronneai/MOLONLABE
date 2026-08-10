"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { LOGO_URL } from "@/lib/brand";

const tabs = [
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/featured", label: "Featured" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/entrants", label: "Entrants" },
];

export default function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await getBrowserSupabase()?.auth.signOut();
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b hairline bg-ink/95 backdrop-blur-sm">
        <div className="px-page flex h-14 items-center justify-between">
          <span className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="" className="h-6 w-auto" />
            <span className="text-[13px] font-extrabold tracking-[-0.02em]">
              MLF ADMIN
            </span>
          </span>
          <button
            type="button"
            onClick={signOut}
            title={email}
            className="label flex h-11 items-center text-muted transition-colors hover:text-bone"
          >
            Sign out
          </button>
        </div>
        <nav aria-label="Admin" className="px-page -mb-px overflow-x-auto">
          <ul className="flex gap-7 whitespace-nowrap">
            {tabs.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={`label inline-flex h-11 items-center border-b transition-colors ${
                    pathname.startsWith(tab.href)
                      ? "border-acid text-acid"
                      : "border-transparent text-muted hover:text-bone"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="px-page pb-24 pt-8">{children}</main>
    </div>
  );
}
