import { notFound } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";
import CampaignForm from "@/components/admin/CampaignForm";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await getSessionSupabase();
  if (!sb) return null;
  const [{ data: campaign }, { data: items }] = await Promise.all([
    sb.from("campaigns").select("*").eq("id", id).maybeSingle(),
    sb.from("items").select("id, name").order("name"),
  ]);
  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">EDIT CAMPAIGN</h1>
      <div className="mt-8">
        <CampaignForm campaign={campaign} items={items ?? []} />
      </div>
    </div>
  );
}
