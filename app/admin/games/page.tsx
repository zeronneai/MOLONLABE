import Link from "next/link";
import { getSessionSupabase } from "@/lib/supabase/session";
import GameCard from "@/components/admin/GameCard";
import EmptyState from "@/components/ui/EmptyState";
import { isDemoGame } from "@/lib/surfaces";
import DemoGamePanel from "@/components/admin/DemoGamePanel";

export const dynamic = "force-dynamic";

export default async function AdminGames() {
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const [{ data: games }, { data: items }] = await Promise.all([
    sb.from("games").select("*").order("created_at", { ascending: false }),
    sb.from("items").select("id, name"),
  ]);
  const itemName = new Map((items ?? []).map((i) => [i.id, i.name]));

  // One query for every game, from the same view the public pages read,
  // rather than one count per game from the table. Two reasons: twenty
  // games was twenty-one round trips, and counting it separately here is
  // how the owner's screen and the customer's screen came to disagree.
  const { data: score } = await sb
    .from("game_scoreboard")
    .select("game_id, sold");
  const soldMap = new Map((score ?? []).map((s) => [s.game_id, s.sold] as const));

  // What each open drop can still sell, counted as game_spots_remaining
  // (and so the public page) counts it: open guides, plus holds an
  // abandoned checkout left over fifteen minutes ago.
  const openIds = (games ?? []).filter((g) => g.status === "open").map((g) => g.id);
  const { data: unsold } = openIds.length
    ? await sb
        .from("game_spots")
        .select("game_id, status, held_at")
        .in("game_id", openIds)
        .neq("status", "sold")
    : { data: [] };
  const staleBefore = Date.now() - 15 * 60 * 1000;
  const availableMap = new Map<string, number>();
  for (const s of unsold ?? []) {
    if (s.status === "open" || (s.status === "held" && s.held_at && Date.parse(s.held_at) < staleBefore)) {
      availableMap.set(s.game_id, (availableMap.get(s.game_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="display text-2xl">DROPS</h1>
        <Link href="/admin/games/new" className="cta-primary control-go !h-11 !px-5">
          + New
        </Link>
      </div>

      <div className="mt-6 border-t hairline">
        {(games ?? []).map((g) => (
          <GameCard
            key={g.id}
            game={g}
            itemName={g.item_id ? itemName.get(g.item_id) : undefined}
            sold={soldMap.get(g.id) ?? 0}
            available={availableMap.get(g.id) ?? 0}
          />
        ))}
        {(games ?? []).length === 0 && (
          <EmptyState
            label="No drops"
            headline="NOTHING RUNNING."
            body="Set up a drop, point it at the featured piece, choose how many guides and what one costs. It opens for sale the moment you create it."
            action={{ href: "/admin/games/new", text: "New drop" }}
          />
        )}
      </div>
      <DemoGamePanel exists={(games ?? []).some((g) => isDemoGame(g.title))} />
    </div>
  );
}
