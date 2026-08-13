import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";
import DrawStage from "@/components/draw/DrawStage";
import { redactName, ticketsFor } from "@/lib/draw/select";
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

  const { data: campaign } = await sb
    .from("campaigns")
    .select("id, title, closes_at, item_id")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const [{ data: item }, { data: entrants }, { data: winner }] = await Promise.all([
    campaign.item_id
      ? sb.from("items").select("name, images").eq("id", campaign.item_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from("entrants")
      .select("id, first_name, last_name, entry_count")
      .eq("campaign_id", id),
    sb.from("winners").select("id").eq("campaign_id", id).maybeSingle(),
  ]);

  // Redaction happens here, at the boundary. The surnames and the rest of
  // the entrant row never cross into the client bundle, so nothing that
  // gets broadcast can contain them even if a component asked.
  const pool: PoolMember[] = (entrants ?? []).map((e) => ({
    id: e.id,
    name: redactName(e.first_name, e.last_name),
    weight: ticketsFor(e.entry_count),
  }));

  const images = Array.isArray(item?.images) ? (item.images as unknown[]) : [];
  const prizeImage = typeof images[0] === "string" ? (images[0] as string) : null;

  return (
    <DrawStage
      campaignId={campaign.id}
      prizeName={item?.name ?? campaign.title}
      prizeImage={prizeImage}
      closesLabel={closesLabel(campaign.closes_at)}
      pool={pool}
      entries={pool.reduce((sum, m) => sum + m.weight, 0)}
      entrants={pool.length}
      alreadyDrawn={Boolean(winner)}
    />
  );
}
