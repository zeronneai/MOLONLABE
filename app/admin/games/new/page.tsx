import { getSessionSupabase } from "@/lib/supabase/session";
import GameForm from "@/components/admin/GameForm";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function NewGame() {
  const sb = await getSessionSupabase();
  if (!sb) return null;
  const { data: items } = await sb
    .from("items")
    .select("id, name, price_cents, price_display")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/admin/inventory" label="All drops" />
      <h1 className="display text-2xl">NEW DROP</h1>
      <p className="mt-4 max-w-[60ch] text-sm text-muted">
        A drop runs until every guide sells. There is no end date to set and
        no countdown to run out. It sells out or it stays open.
      </p>
      <div className="mt-10">
        <GameForm items={items ?? []} />
      </div>
    </div>
  );
}
