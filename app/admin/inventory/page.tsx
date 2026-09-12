import Link from "next/link";
import { getSessionSupabase } from "@/lib/supabase/session";
import { ARCHIVED_STATUS, ITEM_LIVE_STATUSES } from "@/lib/admin/constants";
import { isFirearmCategory } from "@/lib/surfaces";
import { formatUsd } from "@/lib/money";
import ItemAdminCard from "@/components/admin/ItemAdminCard";
import SurfaceSection from "@/components/admin/SurfaceSection";
import EmptyState from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type Search = Promise<{ q?: string; status?: string; deleted?: string }>;

// Archived items are kept out of the working list — that is what archiving
// is for — and are reached through their own filter.
const FILTERS = [
  { key: "", label: "All" },
  ...ITEM_LIVE_STATUSES.map((s) => ({ key: s, label: s })),
  { key: ARCHIVED_STATUS, label: "Archived" },
];

/**
 * Three sections, not one list with a filter.
 *
 * The owner is managing three different kinds of thing — stock he sells,
 * games he runs, and firearms people ask about — and a category filter
 * makes them look like one kind of thing viewed three ways. The grounds
 * are the same ones the home page uses for the same surfaces, so the two
 * screens mirror each other.
 */
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

  const [{ data: items, error }, { data: games }, { data: sold }] = await Promise.all([
    query,
    sb
      .from("games")
      .select("id, title, status, total_spots, spot_price_cents, item_id")
      .order("created_at", { ascending: false }),
    // The same view the public pages count from, so the owner and a
    // customer looking at the same game never see two different numbers.
    sb.from("game_scoreboard").select("game_id, sold"),
  ]);

  const soldBy = new Map((sold ?? []).map((s) => [s.game_id, s.sold] as const));

  // The item attached to a game is managed from the game, not from here.
  const inGames = new Set(
    (games ?? []).map((g) => g.item_id).filter((id): id is string => Boolean(id)),
  );
  const rows = items ?? [];
  const forSale = rows.filter((i) => !isFirearmCategory(i.category) && !inGames.has(i.id));
  const inCase = rows.filter((i) => isFirearmCategory(i.category) && !inGames.has(i.id));

  const filtering = Boolean(q || status);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">WHAT YOU SELL</h1>
      <p className="mt-3 max-w-[56ch] text-sm text-muted">
        Three kinds of thing, three places they show up for customers. The
        colours match the ones on the home page.
      </p>

      <form className="mt-6" action="/admin/inventory" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          aria-label="Search everything"
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
      {error && (
        <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-danger">
          Couldn&apos;t load items: {error.message}
        </p>
      )}

      <div className="mt-8 space-y-2">
        {/* ------------------------------------------------ for sale */}
        <SurfaceSection
          surface="shop"
          count={forSale.length}
          add={{ href: "/admin/inventory/new", label: "+ Add" }}
        >
          {forSale.length > 0 ? (
            forSale.map((item) => <ItemAdminCard key={item.id} item={item} />)
          ) : (
            <p className="py-8 text-sm text-muted">
              {filtering
                ? "Nothing here matches that search."
                : "Nothing for sale yet. Add a shirt, a patch, a box of ammunition — anything with a price."}
            </p>
          )}
        </SurfaceSection>

        {/* --------------------------------------------------- games */}
        <SurfaceSection
          surface="games"
          count={games?.length ?? 0}
          add={{ href: "/admin/games/new", label: "+ New game" }}
        >
          {games && games.length > 0 ? (
            <ul>
              {games.map((g) => {
                const n = soldBy.get(g.id) ?? 0;
                return (
                  <li key={g.id} className="border-b hairline">
                    <Link
                      href={`/admin/games/${g.id}`}
                      className="flex min-h-[56px] items-center justify-between gap-4 py-4"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{g.title}</span>
                        <span className="label mt-1 block">
                          {g.status} · {formatUsd(g.spot_price_cents)} a spot
                        </span>
                      </span>
                      <span className="display shrink-0 text-lg">
                        {n}
                        <span className="opacity-50"> / {g.total_spots}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-sm text-muted">
              No games yet. A game needs a prize, how many spots, and what a
              spot costs.
            </p>
          )}
        </SurfaceSection>

        {/* --------------------------------------------- in the case */}
        <SurfaceSection
          surface="case"
          count={inCase.length}
          add={{ href: "/admin/inventory/new", label: "+ Add" }}
        >
          {inCase.length > 0 ? (
            inCase.map((item) => <ItemAdminCard key={item.id} item={item} />)
          ) : (
            <p className="py-8 text-sm text-muted">
              {filtering
                ? "Nothing here matches that search."
                : "No firearms listed. Add one and it appears in the case with an enquiry button."}
            </p>
          )}
        </SurfaceSection>
      </div>

      {rows.length === 0 && !filtering && (
        <div className="mt-10">
          <EmptyState
            label="Nothing yet"
            headline="NOTHING IS LISTED."
            body="Add the first product and it goes live the moment you save it."
            action={{ href: "/admin/inventory/new", text: "Add an item" }}
          />
        </div>
      )}
    </div>
  );
}
