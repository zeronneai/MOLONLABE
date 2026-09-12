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
    sb.from("winners").select("display_name, ticket").eq("game_id", id).maybeSingle(),
  ]);

  const rows = spots ?? [];
  const sold = rows.filter((s) => s.status === "sold");
  const buyers = new Set(sold.map((s) => (s.email ?? "").toLowerCase())).size;

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/admin/inventory" label="All games" />
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
    </div>
  );
}
