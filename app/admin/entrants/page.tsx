import { getSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function AdminEntrants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const sb = await getSessionSupabase();
  if (!sb) return null;

  let query = sb.from("entrants").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  const [{ data: entrants }, { data: campaigns }] = await Promise.all([
    query,
    sb.from("campaigns").select("id, title"),
  ]);
  const campaignTitle = new Map((campaigns ?? []).map((c) => [c.id, c.title]));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="display text-2xl">ENTRANTS</h1>
        <a href="/admin/entrants/export" className="cta-primary !h-11 !px-5">
          Export CSV
        </a>
      </div>

      <form className="mt-6" action="/admin/entrants" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          aria-label="Search entrants"
          className="field-input"
        />
      </form>

      <div className="mt-6 border-t hairline">
        {(entrants ?? []).map((e) => (
          <div key={e.id} className="border-b hairline py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-extrabold tracking-[-0.02em]">
                {e.first_name} {e.last_name}
                {e.entry_count > 1 && (
                  <span className="ml-2 text-acid">×{e.entry_count}</span>
                )}
              </p>
              <p className="label shrink-0 text-muted">{e.source ?? "online"}</p>
            </div>
            <p className="mt-1 text-sm text-muted">
              {e.email}
              {e.phone ? ` · ${e.phone}` : ""}
            </p>
            {e.campaign_id && (
              <p className="label mt-1 text-muted">
                {campaignTitle.get(e.campaign_id) ?? "—"}
              </p>
            )}
          </div>
        ))}
        {(entrants ?? []).length === 0 && (
          <p className="label py-10 text-muted">No entrants{q ? " match" : " yet"}.</p>
        )}
      </div>
    </div>
  );
}
