import type { Metadata, Viewport } from "next";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminShell from "@/components/admin/AdminShell";
import NoAccess from "@/components/admin/NoAccess";
import { ROLES_MIGRATION, getStaff } from "@/lib/admin/staff";

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
  const who = await getStaff();
  if (!who.ok && who.reason === "unconfigured") {
    return (
      <div className="px-page flex min-h-svh flex-col items-start justify-center">
        <p className="label text-danger">Admin unavailable</p>
        <p className="mt-4 max-w-md text-muted">
          Supabase isn&apos;t configured in this environment.
        </p>
      </div>
    );
  }
  if (!who.ok && who.reason === "signed-out") return <AdminLogin />;
  // Signed in, but not somebody this admin knows. Before roles, any
  // account that could sign in was a full admin; now an account needs a
  // row in the staff table, which only the owner can add.
  if (!who.ok) return <NoAccess reason={who.reason === "no-access" ? "no-access" : "error"} />;

  const { staff } = who;
  return (
    <AdminShell
      who={staff.name}
      role={staff.role}
      rolesMissing={staff.rolesMissing}
      migration={ROLES_MIGRATION}
    >
      {children}
    </AdminShell>
  );
}
