import type { Metadata } from "next";
import Link from "next/link";
import { getAllGames } from "@/lib/games/queries";
import GameCard from "@/components/games/GameCard";
import EmptyState from "@/components/ui/EmptyState";
import { SHOP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/games" },
  title: "Games",
  description: `Open and completed games at ${SHOP_NAME}, El Paso, TX.`,
};

export default async function GamesPage() {
  const { open, awaiting, finished } = await getAllGames();

  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Games</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
        A FIXED
        <br />
        NUMBER.
      </h1>
      <p className="mt-8 max-w-[54ch] text-muted">
        Every game sells a set number of spots at a set price. When the
        last one goes, one spot is drawn. No end date, no countdown — it
        runs until it fills.
      </p>

      {/* ------------------------------------------------- open */}
      <section className="mt-16" aria-labelledby="open-games">
        <h2 id="open-games" className="label text-acid">
          Open now
        </h2>
        {open.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((g) => (
              <GameCard key={g.id} game={g} state="open" />
            ))}
          </div>
        ) : (
          /* The empty state is suppressed when something is awaiting its
             draw. "Nothing is running right now" would be false with a
             full pool sitting directly underneath, and the section below
             says what is actually happening. */
          awaiting.length === 0 && (
            <div className="mt-6">
              <EmptyState
                label="Nothing running"
                headline="NO GAME IS OPEN."
                body="Nothing is running right now. The next one goes up here the moment it opens — and it sells until the last spot goes, so there is no date to miss."
                action={{ href: "/in-the-case", text: "See what's in the case" }}
              />
            </div>
          )
        )}
        {open.length === 0 && awaiting.length > 0 && (
          <p className="mt-6 max-w-[52ch] text-muted">
            Nothing is open for spots at the moment. The game below filled
            and is waiting on its draw.
          </p>
        )}
      </section>

      {/* -------------------------------------- awaiting the draw */}
      {awaiting.length > 0 && (
        <section
          className="mt-20 border-t hairline pt-12"
          aria-labelledby="awaiting-games"
        >
          <h2 id="awaiting-games" className="label text-amber">
            Awaiting the draw
          </h2>
          <p className="mt-3 max-w-[52ch] text-sm text-muted">
            Every spot is taken. Nothing here can be bought — the draw is
            what happens next, and the winner is posted on the game.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {awaiting.map((g) => (
              <GameCard key={g.id} game={g} state="awaiting" />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------- history */}
      {finished.length > 0 && (
        <section className="mt-20 border-t hairline pt-12" aria-labelledby="past-games">
          <h2 id="past-games" className="label text-muted">
            Finished
          </h2>
          <p className="mt-3 max-w-[52ch] text-sm text-muted">
            Games that filled and drew. Winners are shown as a first name
            and last initial — never more than that.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {finished.map((g) => (
              <GameCard key={g.id} game={g} state="finished" />
            ))}
          </div>
        </section>
      )}

      <div className="mt-20 border-t hairline pt-8">
        <Link href="/sweepstakes-rules" className="cta-secondary">
          Official rules
        </Link>
        <p className="mt-2 max-w-[60ch] text-xs text-muted">
          Open only to legal residents who may lawfully take possession of a
          firearm under federal, state and local law. Void where prohibited.
        </p>
      </div>
    </div>
  );
}
