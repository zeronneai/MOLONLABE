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

  // An item attached to a game is managed from the game — but it must
  // still be VISIBLE here. It used to be filtered out of both lists while
  // the Games section listed games rather than items, so an item put up
  // as a prize vanished from the admin completely. An item the owner
  // cannot see is an item he cannot fix.
  const gameOf = new Map<string, { title: string; status: string; id: string }>();
  for (const g of games ?? []) {
    if (g.item_id) gameOf.set(g.item_id, { title: g.title, status: g.status, id: g.id });
  }
  const rows = items ?? [];
  const asPrize = rows.filter((i) => gameOf.has(i.id));
  const forSale = rows.filter((i) => !isFirearmCategory(i.category) && !gameOf.has(i.id));
  const inCase = rows.filter((i) => isFirearmCategory(i.category) && !gameOf.has(i.id));

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
          unit="drop"
          add={{ href: "/admin/games/new", label: "+ New drop" }}
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
                          {g.status} · {formatUsd(g.spot_price_cents)} a guide
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
              No drops yet. A drop needs a featured piece, how many guides,
              and what a guide costs.
            </p>
          )}
        </SurfaceSection>

        {/* ------------------------------------------ prizes in games */}
        {/* Same ground as Games above, and a heading of its own.
            The colour ties it to the green band customers see, which is
            the point of the ground — but this is a list of ITEMS and the
            one above is a list of GAMES, and two headings both reading
            "Games" made them look like one thing shown twice.

            Every item lands in exactly one of the four sections. The
            arithmetic is asserted at the bottom of the page rather than
            trusted, because the failure mode is silence. */}
        {asPrize.length > 0 && (
          <SurfaceSection
            surface="games"
            id="prizes"
            heading="Items used as prizes"
            blurb="These are the featured pieces in drops. They are out of the Shop and out of the case, and cannot be bought online: customers buy guides to them, with entry into the drawing. After the draw they never return to the website. The piece is hidden until the winner claims it, then sold. An unclaimed piece is sold in the shop only."
            count={asPrize.length}
          >
            {asPrize.map((item) => {
              const g = gameOf.get(item.id)!;
              const locked = g.status === "open" || g.status === "full";
              return (
                <div key={item.id} className="border-b hairline py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <Link
                      href={`/admin/inventory/${item.id}`}
                      className="min-w-0 flex-1 truncate text-sm"
                    >
                      {item.name}
                    </Link>
                    <Link
                      href={`/admin/games/${g.id}`}
                      className={`label shrink-0 ${locked ? "text-amber" : "text-muted"}`}
                    >
                      {locked ? "prize · not for sale" : "was a prize · back on sale"}
                    </Link>
                  </div>
                  <p className="label mt-1 text-muted">
                    {g.title} · {g.status}
                  </p>
                </div>
              );
            })}
          </SurfaceSection>
        )}

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

      {/* The guarantee, checked rather than assumed: every item the query
          returned is in one of the sections above. If this ever shows, an
          item is invisible again and the owner is told so instead of
          being left to notice. */}
      {rows.length !== forSale.length + inCase.length + asPrize.length && (
        <p className="mt-8 border-l-2 border-danger pl-5 text-sm text-danger">
          {rows.length - (forSale.length + inCase.length + asPrize.length)} item(s)
          are not shown in any section above. This is a bug — tell Purple
          Roots, and use the search to reach them meanwhile.
        </p>
      )}

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
