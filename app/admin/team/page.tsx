import { OwnerOnlyNote } from "@/components/admin/Role";
import AlertRoutingForm from "@/components/admin/AlertRouting";
import { getStaff } from "@/lib/admin/staff";
import { ALERT_ROUTING_KEY, readRouting } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/**
 * The people with access, and where alerts go.
 *
 * Accounts are not created or changed here. That is deliberate: an
 * admin screen that can grant the owner role is one stolen session away
 * from a stranger owning the shop. Access is granted in the Supabase SQL
 * editor, which needs the Supabase login, not this one. docs/roles.md.
 */
export default async function TeamPage() {
  const me = await getStaff();
  if (!me.ok) return null;
  const { sb, role } = me.staff;

  const [{ data: team }, { data: routingRow }] = await Promise.all([
    role === "owner"
      ? sb.from("staff").select("user_id, display_name, role, created_at").order("role").order("display_name")
      : Promise.resolve({ data: null }),
    sb.from("settings").select("value").eq("key", ALERT_ROUTING_KEY).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">TEAM &amp; ALERTS</h1>

      <section className="mt-8">
        <h2 className="label text-acid">Who has access</h2>
        {role === "owner" ? (
          <>
            <div className="mt-4 border-t hairline">
              {(team ?? []).map((p) => (
                <div key={p.user_id} data-team-member className="flex items-baseline justify-between border-b hairline py-3">
                  <span className="text-sm">{p.display_name}</span>
                  <span className="label text-muted">{p.role === "owner" ? "Owner" : "Manager"}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 max-w-[60ch] text-sm text-muted">
              Accounts are added, changed and removed in the Supabase dashboard, not
              here, so that nobody signed in to this admin can give themselves or
              anyone else more access. The steps are in docs/roles.md.
            </p>
          </>
        ) : (
          <OwnerOnlyNote />
        )}
      </section>

      <section className="mt-14 border-t hairline pt-8 pb-10">
        <h2 className="label text-acid">Who gets alerts</h2>
        <div className="mt-6">
          <AlertRoutingForm routing={readRouting(routingRow?.value)} />
        </div>
      </section>
    </div>
  );
}
