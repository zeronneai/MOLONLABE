import { getSessionSupabase } from "@/lib/supabase/session";
import GameForm from "@/components/admin/GameForm";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default async function NewGame() {
  const sb = await getSessionSupabase();
  if (!sb) return null;
  const { data: items } = await sb
    .from("items")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/admin/inventory" label="All games" />
      <h1 className="display text-2xl">NEW GAME</h1>
      <p className="mt-4 max-w-[60ch] text-sm text-muted">
        A game runs until every spot sells. There is no end date to set and
        no countdown to run out — it fills or it stays open.
      </p>
      <div className="mt-10">
        <GameForm items={items ?? []} />
      </div>
    </div>
  );
}
