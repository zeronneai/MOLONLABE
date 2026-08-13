import Link from "next/link";
import { getSessionSupabase } from "@/lib/supabase/session";
import CampaignCard from "@/components/admin/CampaignCard";
import EmptyState from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminFeatured() {
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const [{ data: campaigns }, { data: items }] = await Promise.all([
    sb.from("campaigns").select("*").order("created_at", { ascending: false }),
    sb.from("items").select("id, name"),
  ]);
  const itemName = new Map((items ?? []).map((i) => [i.id, i.name]));

  const counts = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data } = await sb.rpc("entry_count", { campaign: c.id });
      return [c.id, data ?? 0] as const;
    }),
  );
  const countMap = new Map(counts);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="display text-2xl">FEATURED</h1>
        <Link href="/admin/featured/new" className="cta-primary control-go !h-11 !px-5">
          + New
        </Link>
      </div>

      <div className="mt-6 border-t hairline">
        {(campaigns ?? []).map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            itemName={c.item_id ? itemName.get(c.item_id) : undefined}
            entries={countMap.get(c.id) ?? 0}
          />
        ))}
        {(campaigns ?? []).length === 0 && (
          <EmptyState
            label="No campaign"
            headline="NOTHING ON THE BLOCK."
            body="Set up a campaign, point it at an item, give it a close date. Entries start the moment you set it live."
            action={{ href: "/admin/featured/new", text: "New campaign" }}
          />
        )}
      </div>
    </div>
  );
}
