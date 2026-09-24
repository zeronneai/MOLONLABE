import { notFound } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";
import GameForm from "@/components/admin/GameForm";
import DrawPanel from "@/components/admin/DrawPanel";
import SpotLedger from "@/components/admin/SpotLedger";
import BackLink from "@/components/admin/BackLink";

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
      .select("spot_number, status, first_name, last_name, email, sold_at")
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
  const { data: winningOrder } = contact?.order_id
    ? await sb.from("orders").select("order_number").eq("id", contact.order_id).maybeSingle()
    : { data: null };

  const rows = spots ?? [];
  const sold = rows.filter((s) => s.status === "sold");
  const buyers = new Set(sold.map((s) => (s.email ?? "").toLowerCase())).size;

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/admin/inventory" label="All drops" />
      <h1 className="display text-2xl">{game.title.toUpperCase()}</h1>
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
        }))}
        gameId={game.id}
      />

      <DrawPanel
        gameId={game.id}
        gameTitle={game.title}
        spotsSold={sold.length}
        totalSpots={game.total_spots}
        buyers={buyers}
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
        </section>
      )}
    </div>
  );
}
