import { notFound } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";
import GameForm from "@/components/admin/GameForm";
import DrawPanel from "@/components/admin/DrawPanel";
import SpotLedger from "@/components/admin/SpotLedger";
import BackLink from "@/components/admin/BackLink";
import HomeDropControl from "@/components/admin/HomeDropControl";
import { dropPath } from "@/lib/games/paths";
import PrizeClaim from "@/components/admin/PrizeClaim";
import { loadSoldGuides } from "@/lib/draw/soldGuides";
import { buildRoster } from "@/lib/draw/roster";
import InStoreSale, { type InStoreSaleRow } from "@/components/admin/InStoreSale";

export const dynamic = "force-dynamic";

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const [{ data: game }, { data: items }] = await Promise.all([
    sb.from("games").select("*").eq("id", id).maybeSingle(),
    sb.from("items").select("id, name, price_cents, price_display").order("name"),
  ]);
  if (!game) notFound();

  // The owner's view is the only one that sees who holds what. It reads
  // the table rather than the public view, and it is behind auth.
  const [{ data: spots }, { data: winner }] = await Promise.all([
    sb
      .from("game_spots")
      .select("spot_number, status, first_name, last_name, email, sold_at, order_id, held_at")
      .eq("game_id", id)
      .order("spot_number"),
    sb.from("winners").select("display_name, ticket, spot_id").eq("game_id", id).maybeSingle(),
  ]);

  // Who to call. The public board shows a redacted name; the person
  // running the draw needs the real one and a way to reach them, and
  // for a month that person is the manager. Read from the spot the draw
  // recorded, not by matching a name, so two buyers called Ana cannot
  // be confused.
  const { data: contact } = winner?.spot_id
    ? await sb
        .from("game_spots")
        .select("spot_number, first_name, last_name, email, phone, order_id")
        .eq("id", winner.spot_id)
        .maybeSingle()
    : { data: null };
  const { data: prize } = winner && game.item_id
    ? await sb.from("items").select("name, status").eq("id", game.item_id).maybeSingle()
    : { data: null };
  const { data: winningOrder } = contact?.order_id
    ? await sb.from("orders").select("order_number").eq("id", contact.order_id).maybeSingle()
    : { data: null };

  // Sales at the counter for this drop, voided ones included so the
  // record of a mistake and its correction stays on the page.
  const { data: inStoreOrders } = await sb
    .from("orders")
    .select("id, order_number, first_name, last_name, recorded_by_name, created_at, voided_at, voided_by_name")
    .eq("game_id", id)
    .eq("source", "in_store")
    .order("created_at", { ascending: false });
  const inStoreIds = (inStoreOrders ?? []).map((o) => o.id);
  const { data: inStoreLines } = inStoreIds.length
    ? await sb.from("order_items").select("order_id, spot_numbers").in("order_id", inStoreIds)
    : { data: [] };
  const numbersOf = new Map((inStoreLines ?? []).map((l) => [l.order_id, l.spot_numbers ?? []]));
  const inStoreSales: InStoreSaleRow[] = (inStoreOrders ?? []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    buyer: `${o.first_name} ${o.last_name}`,
    numbers: numbersOf.get(o.id) ?? [],
    recordedBy: o.recorded_by_name,
    at: o.created_at,
    voidedAt: o.voided_at,
    voidedBy: o.voided_by_name,
  }));
  const inStoreOrderIds = new Set(inStoreIds);

  const rows = spots ?? [];
  const sold = rows.filter((s) => s.status === "sold");
  const buyers = new Set(sold.map((s) => (s.email ?? "").toLowerCase())).size;

  // How many buyers will appear on the broadcast by guide number rather
  // than by name, because they have not agreed to be named. The same
  // roster the presentation builds, so this cannot say one number and
  // the video show another.
  const soldGuides = await loadSoldGuides(sb, id);
  const unnamedBuyers = soldGuides.ok
    ? buildRoster(soldGuides.guides).filter((r) => !r.named).length
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/admin/inventory" label="All drops" />
      <h1 className="display text-2xl">{game.title.toUpperCase()}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={dropPath(game.id)}
          target="_blank"
          rel="noopener"
          className="label text-muted underline hover:text-bone"
          data-view-on-site
        >
          View on site →
        </a>
        <HomeDropControl
          gameId={game.id}
          featured={game.featured_on_home === true}
          running={game.status === "open" || game.status === "full"}
        />
      </div>
      <div className="mt-8">
        <GameForm game={game} items={items ?? []} />
      </div>

      <SpotLedger
        spots={rows.map((s) => ({
          spotNumber: s.spot_number,
          status: s.status as "open" | "held" | "sold",
          name:
            s.status === "sold"
              ? [s.first_name, s.last_name].filter(Boolean).join(" ") || "—"
              : null,
          email: s.status === "sold" ? s.email : null,
          soldAt: s.sold_at,
          inStore: Boolean(s.order_id && inStoreOrderIds.has(s.order_id)),
        }))}
        gameId={game.id}
      />

      <InStoreSale
        gameId={game.id}
        status={game.status}
        drawn={Boolean(winner)}
        // What the website could sell: open guides, and holds an abandoned
        // checkout left over fifteen minutes ago, as game_spots_remaining counts.
        available={rows.filter((r) => r.status === "open" ||
          (r.status === "held" && r.held_at !== null && Date.now() - Date.parse(r.held_at) > 15 * 60 * 1000)).length}
        sales={inStoreSales}
      />

      <DrawPanel
        gameId={game.id}
        gameTitle={game.title}
        spotsSold={sold.length}
        totalSpots={game.total_spots}
        buyers={buyers}
        unnamedBuyers={unnamedBuyers}
        winnerName={winner?.display_name ?? null}
        winningSpot={winner?.ticket ?? null}
      />

      {winner && (
        <section data-winner-contact className="mt-10 border hairline p-6">
          <h2 className="label text-acid">Contact the winner</h2>
          {contact ? (
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-3 text-sm">
              <dt className="label text-muted">Name</dt>
              <dd>{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Not given"}</dd>
              <dt className="label text-muted">Email</dt>
              <dd>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="underline">{contact.email}</a>
                ) : (
                  "Not given"
                )}
              </dd>
              <dt className="label text-muted">Phone</dt>
              <dd>
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="underline">{contact.phone}</a>
                ) : (
                  "Not given"
                )}
              </dd>
              <dt className="label text-muted">Guide</dt>
              <dd className="tabular-nums">#{contact.spot_number}</dd>
              {winningOrder?.order_number && (
                <>
                  <dt className="label text-muted">Order</dt>
                  <dd className="tabular-nums">{winningOrder.order_number}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">
              The draw did not record which guide number won, so there are no
              contact details to show. The list of guides sold above has every
              buyer.
            </p>
          )}
          {prize && (
            <PrizeClaim gameId={game.id} pieceName={prize.name} claimed={prize.status === "sold"} />
          )}
        </section>
      )}
    </div>
  );
}
