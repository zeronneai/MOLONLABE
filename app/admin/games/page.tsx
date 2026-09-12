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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="display text-2xl">GAMES</h1>
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
          />
        ))}
        {(games ?? []).length === 0 && (
          <EmptyState
            label="No games"
            headline="NOTHING RUNNING."
            body="Set up a game, point it at the prize, choose how many spots and what one costs. It opens for sale the moment you create it."
            action={{ href: "/admin/games/new", text: "New game" }}
          />
        )}
      </div>
      <DemoGamePanel exists={(games ?? []).some((g) => isDemoGame(g.title))} />
    </div>
  );
}
