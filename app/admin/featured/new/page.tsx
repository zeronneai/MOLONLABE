import { getSessionSupabase } from "@/lib/supabase/session";
import CampaignForm from "@/components/admin/CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const sb = await getSessionSupabase();
  if (!sb) return null;
  const { data: items } = await sb
    .from("items")
    .select("id, name")
    .neq("status", "hidden")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">NEW CAMPAIGN</h1>
      <div className="mt-8">
        <CampaignForm items={items ?? []} />
      </div>
    </div>
  );
}
