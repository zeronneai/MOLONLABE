import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStaff } from "@/lib/admin/staff";
import { buildRoster } from "@/lib/draw/roster";
import DrawStage from "@/components/draw/DrawStage";

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
  // Staff only. The middleware lets any signed-in account through; the
  // pool and the draw are for the owner and the manager.
  const who = await getStaff();
  if (!who.ok) notFound();
  const { sb } = who.staff;

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
      .select("spot_number, first_name, last_name, email")
      .eq("game_id", id)
      .eq("status", "sold")
      .order("spot_number"),
    sb.from("winners").select("id").eq("game_id", id).maybeSingle(),
  ]);

  // Every buyer, once, with their guide count: the roster shown before
  // the wheel spins, and the wheel's wedges. Built here, on the server,
  // so what reaches the screen being filmed is first name and last
  // initial only. The email that groups a buyer's guides never leaves
  // this function.
  const roster = buildRoster(spots ?? []);
  const shownGuides = (spots ?? []).map((sp) => sp.spot_number);

  const images = Array.isArray(item?.images) ? (item.images as unknown[]) : [];
  const prizeImage = typeof images[0] === "string" ? (images[0] as string) : null;

  return (
    <DrawStage
      gameId={game.id}
      prizeName={item?.name ?? game.title}
      prizeImage={prizeImage}
      closesLabel={`${shownGuides.length} of ${game.total_spots} guides sold`}
      roster={roster}
      shownGuides={shownGuides}
      alreadyDrawn={Boolean(winner)}
      unsoldSpots={Math.max(0, game.total_spots - shownGuides.length)}
    />
  );
}
