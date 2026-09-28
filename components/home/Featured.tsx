import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { getAllGames, getHomeDrop, getSpotCounts } from "@/lib/games/queries";
import { gameState } from "@/lib/games/types";
import type { GameStatus } from "@/lib/games/types";
import { itemImages } from "@/lib/db/items";
import { dropPath } from "@/lib/games/paths";
import { demoStrippedTitle } from "@/lib/surfaces";
import GameCard from "@/components/games/GameCard";

/**
 * The drop section of the home page.
 *
 * It features the drop the owner chose in the admin, and links to it by
 * its own address. It used to feature whichever drop was newest and send
 * every button to a page that did the same, so with two drops open the
 * older one could not be reached from the site at all.
 *
 * Nothing chosen and several drops running: every running drop is shown,
 * each to its own page, rather than one picked for the owner.
 */
export default async function Featured() {
  const { featured: game, running } = await getHomeDrop();

  if (!game && running.length > 1) return <AllRunning />;

  if (!game) {
    return (
      <section data-empty-state className="ground-acid px-page flex min-h-[40vh] flex-col justify-center py-20">
        <Reveal>
          <p className="label">Featured drop</p>
          <h2 className="display mt-6 max-w-2xl text-[clamp(2rem,4vw,3.5rem)]">
            NOTHING ON THE BLOCK RIGHT NOW.
          </h2>
          <p className="mt-6 max-w-md text-muted">
            The next feature is announced on Instagram first. Follow
            @molonlabe.fa or check back.
          </p>
        </Reveal>
      </section>
    );
  }

  const counts = await getSpotCounts(game.id, game.total_spots);
  const image = game.item ? itemImages(game.item)[0] : undefined;
  const title = demoStrippedTitle(game.title);
  const piece = game.item?.name ?? null;
  const showPiece = piece && piece.trim().toUpperCase() !== title.trim().toUpperCase();
  const href = dropPath(game.id);
  const others = running.filter((g) => g.id !== game.id);
  // Same rule as the games list, from the same place, so the home page
  // and /games cannot describe one game two different ways.
  const state = gameState({
    status: game.status as GameStatus,
    sold: counts.sold,
    totalSpots: counts.total,
  });
  const awaiting = state === "awaiting";

  return (
    /* The green ground. This is the one section on the page where acid
       is a field rather than an accent, and it is the game — the thing
       the client most wants a visitor to notice they have wandered into.
       Controls inside it stay bone on ink; see globals.css. */
    <section className="ground-acid grid min-h-[85vh] lg:grid-cols-[3fr_2fr]">
      {/* Left 60%: the pitch */}
      <div className="pl-page order-2 flex flex-col justify-center py-16 pr-8 lg:order-1 lg:py-24">
        <Reveal>
          <p className="label">
            {awaiting ? "Sold out, awaiting the draw" : "Featured drop"}
          </p>
          <h2 className="display mt-6 text-[clamp(2.25rem,4.5vw,4.5rem)]" data-home-drop={game.id}>
            {title.toUpperCase()}
          </h2>
          {showPiece && (
            <p className="mt-4 text-lg">
              <span className="text-muted">Featured piece: </span>
              <strong className="font-extrabold tracking-[-0.02em]">{piece}</strong>
            </p>
          )}
          {game.description && (
            <p className="mt-6 max-w-md text-muted">{game.description}</p>
          )}
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-12 flex flex-wrap items-end gap-x-16 gap-y-8">
            {/* The scoreboard, in the largest type on the page. The
                count is the whole tension of a fixed-pool game — it is
                not a statistic about the game, it IS the game. */}
            <div>
              <div className="display text-[72px] leading-none tabular-nums">
                {counts.remaining}
                <span className="text-muted">/{counts.total}</span>
              </div>
              <div className="label mt-2 text-muted">
                {awaiting ? "Every guide sold" : "Guides left"}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-12">
            {/* The primary call to action is a buy control, so a game
                with nothing to sell does not get one. It keeps a way
                through to the board, at secondary weight. */}
            {awaiting ? (
              <>
                <p className="max-w-md text-muted">
                  Nothing left to buy. The draw happens next. The winner
                  is posted on the drop and announced on Instagram.
                </p>
                <Link href={href} className="cta-secondary mt-6">
                  See this drop →
                </Link>
              </>
            ) : (
              <Link href={href} className="cta-primary">
                Get your guide
              </Link>
            )}
          </div>
          {/* The other running drops, by name, each to its own page. */}
          {others.length > 0 && (
            <div className="mt-10 max-w-md border-t border-current/20 pt-5" data-home-others>
              <p className="label">
                {others.length === 1 ? "Also running" : `${others.length} more drops running`}
              </p>
              <ul className="mt-3 space-y-2">
                {others.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={dropPath(g.id)}
                      className="font-extrabold tracking-[-0.02em] underline decoration-1 underline-offset-4"
                    >
                      {demoStrippedTitle(g.title)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Reveal>
      </div>

      {/* Right 40%: image bleeds off the right edge, full section height */}
      <div className="relative order-1 min-h-[50vh] bg-surface lg:order-2 lg:min-h-0">
        {image && (
          <Image
            src={image}
            alt={piece ?? title}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
    </section>
  );
}

/** Several drops running and none chosen for the home page: all of them. */
async function AllRunning() {
  const { open, awaiting } = await getAllGames();
  const drops = [...open.map((g) => ({ g, state: "open" as const })), ...awaiting.map((g) => ({ g, state: "awaiting" as const }))];
  return (
    <section className="ground-acid px-page py-20" data-home-all-drops>
      <Reveal>
        <p className="label">Drops running now</p>
        <h2 className="display mt-6 max-w-2xl text-[clamp(2rem,4vw,3.5rem)]">
          {drops.length} DROPS RUNNING.
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-6 text-bone sm:grid-cols-2 lg:grid-cols-3">
        {drops.map(({ g, state }) => (
          <GameCard key={g.id} game={g} state={state} />
        ))}
      </div>
    </section>
  );
}
