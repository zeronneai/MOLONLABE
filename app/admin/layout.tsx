import type { Metadata, Viewport } from "next";
import { getSessionSupabase } from "@/lib/supabase/session";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "MLF Admin",
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0B0A0C",
};

// Session comes from cookies on every request — the whole segment is
// dynamic, even when built without Supabase env vars.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await getSessionSupabase();
  if (!sb) {
    return (
      <div className="px-page flex min-h-svh flex-col items-start justify-center">
        <p className="label text-danger">Admin unavailable</p>
        <p className="mt-4 max-w-md text-muted">
          Supabase isn&apos;t configured in this environment.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return <AdminLogin />;

  return <AdminShell email={user.email ?? ""}>{children}</AdminShell>;
}
