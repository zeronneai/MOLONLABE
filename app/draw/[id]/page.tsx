import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";
import DrawStage from "@/components/draw/DrawStage";
import { ticketsFor } from "@/lib/draw/select";
import type { PoolMember } from "@/lib/draw/presentation";

// Deliberately outside both the public (site) group and the /admin
// segment: no site chrome, no admin shell, no navigation of any kind. The
// URL reads /draw/<id>, which gives nothing away if it ends up in frame.
// Access is still owner-only — middleware guards this path exactly as it
// guards /admin.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draw",
  robots: { index: false, follow: false },
};

function closesLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export default async function DrawPresentation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const { data: game } = await sb
    .from("games")
    .select("id, title, item_id, total_spots")
    .eq("id", id)
    .maybeSingle();
  if (!game) notFound();

  const [{ data: item }, { data: spots }, { data: winner }] = await Promise.all([
    game.item_id
      ? sb.from("items").select("name, images").eq("id", game.item_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from("game_spots")
      .select("id, spot_number")
      .eq("game_id", id)
      .eq("status", "sold")
      .order("spot_number"),
    sb.from("winners").select("id").eq("game_id", id).maybeSingle(),
  ]);

  // One tile per sold spot, weight one. Somebody holding five spots
  // occupies five tiles because they own five of them, not because of any
  // arithmetic about weights.
  //
  // Numbers, never names. This is filmed and posted publicly, and there
  // is no opt-in any more for a buyer to have agreed to that with — so
  // the tiles carry the one thing that identifies a spot without
  // identifying a person.
  //
  // No name is fetched at all, rather than fetched and not rendered.
  // Nothing that gets broadcast can contain a name that never left the
  // database.
  const pool: PoolMember[] = (spots ?? []).map((sp) => ({
    id: sp.id,
    name: `Spot ${sp.spot_number}`,
    weight: 1,
  }));

  const images = Array.isArray(item?.images) ? (item.images as unknown[]) : [];
  const prizeImage = typeof images[0] === "string" ? (images[0] as string) : null;

  return (
    <DrawStage
      gameId={game.id}
      prizeName={item?.name ?? game.title}
      prizeImage={prizeImage}
      closesLabel={`${pool.length} of ${game.total_spots} spots sold`}
      pool={pool}
      entries={pool.length}
      entrants={new Set((spots ?? []).map((sp) => sp.spot_number)).size}
      alreadyDrawn={Boolean(winner)}
      unsoldSpots={Math.max(0, game.total_spots - pool.length)}
    />
  );
}
