import Link from "next/link";
import { getSessionSupabase } from "@/lib/supabase/session";
import { ARCHIVED_STATUS, ITEM_LIVE_STATUSES } from "@/lib/admin/constants";
import ItemAdminCard from "@/components/admin/ItemAdminCard";

export const dynamic = "force-dynamic";

type Search = Promise<{ q?: string; status?: string; deleted?: string }>;

// Archived items are kept out of the working list — that is what archiving
// is for — and are reached through their own filter.
const FILTERS = [
  { key: "", label: "All" },
  ...ITEM_LIVE_STATUSES.map((s) => ({ key: s, label: s })),
  { key: ARCHIVED_STATUS, label: "Archived" },
];

export default async function AdminInventory({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { q = "", status = "", deleted = "" } = await searchParams;
  const sb = await getSessionSupabase();
  if (!sb) return null;

  let query = sb
    .from("items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (q) query = query.ilike("name", `%${q}%`);
  if (status) query = query.eq("status", status);
  else query = query.neq("status", ARCHIVED_STATUS);
  const { data: items, error } = await query;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="display text-2xl">INVENTORY</h1>
        <Link href="/admin/inventory/new" className="cta-primary control-go !h-11 !px-5">
          + Add
        </Link>
      </div>

      <form className="mt-6" action="/admin/inventory" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          aria-label="Search inventory"
          className="field-input"
        />
        {status && <input type="hidden" name="status" value={status} />}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key || "all"}
            href={
              f.key
                ? `/admin/inventory?${new URLSearchParams({ ...(q ? { q } : {}), status: f.key })}`
                : `/admin/inventory${q ? `?q=${encodeURIComponent(q)}` : ""}`
            }
            className="control control-sm tone-acid"
            aria-pressed={status === f.key}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {deleted && (
        <p role="status" className="label mt-6 text-acid">
          Item deleted.
        </p>
      )}

      <div className="mt-6 border-t hairline">
        {error && (
          <p className="py-8 text-[11px] uppercase tracking-[0.18em] text-danger">
            Couldn&apos;t load items: {error.message}
          </p>
        )}
        {items?.map((item) => <ItemAdminCard key={item.id} item={item} />)}
        {items?.length === 0 && (
          <p className="label py-10 text-muted">Nothing matches.</p>
        )}
      </div>
    </div>
  );
}
