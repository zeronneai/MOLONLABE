"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { LOGO_URL } from "@/lib/brand";
import Toast from "@/components/admin/Toast";
import { RoleProvider, type Role } from "@/components/admin/Role";

const tabs = [
  // "What you sell" holds all three surfaces side by side, which is how
  // the owner tells them apart. Games keeps its own tab as well: it is
  // where a game is created and drawn, and dropping it left that page
  // reachable only by typing the URL.
  { href: "/admin/inventory", label: "What you sell" },
  { href: "/admin/games", label: "Drops" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/game", label: "Arcade & Offer" },
  { href: "/admin/commerce", label: "Tax & Shipping" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/team", label: "Team & alerts" },
];

export default function AdminShell({
  who,
  role,
  rolesMissing = false,
  migration,
  children,
}: {
  /** The signed-in person's display name. Never their email address. */
  who: string;
  role: Role;
  /** The staff table does not exist yet: roles are not in force. */
  rolesMissing?: boolean;
  migration?: string;
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
          {/* The skull is the way home. It was a span, which meant the
              only route back from a detail screen was the browser's own
              back button — and on a phone, held one-handed, that is not a
              route anybody finds. */}
          <Link
            href="/admin"
            className="-ml-2 flex h-11 items-center gap-3 px-2 transition-colors hover:text-acid"
            aria-label="Admin home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="" className="h-6 w-auto" />
            <span className="text-[13px] font-extrabold tracking-[-0.02em]">
              MLF ADMIN
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {/* Who and as what, always visible. A manager who can see
                that he is signed in as the manager understands a
                disabled button; one who cannot, reports it as broken. */}
            <span data-signed-in-as className="label hidden text-muted sm:inline">
              {who} · {role === "owner" ? "Owner" : "Manager"}
            </span>
            <button
              type="button"
              onClick={signOut}
              title={`Signed in as ${who}`}
              className="label flex h-11 items-center text-muted transition-colors hover:text-bone"
            >
              Sign out
            </button>
          </div>
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
      {rolesMissing && (
        <div role="alert" className="px-page border-b border-danger bg-surface py-3">
          <p className="label text-danger">
            Roles are not in force. The database is missing {migration}. Until it is
            applied, every account has full access. Apply it in the Supabase SQL editor.
          </p>
        </div>
      )}
      <main className="px-page pb-24 pt-8">
        <RoleProvider role={role}>{children}</RoleProvider>
      </main>
      <Toast />
    </div>
  );
}
