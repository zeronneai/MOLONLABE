import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { getCurrentGame, getSpotCounts } from "@/lib/games/queries";
import { gameState } from "@/lib/games/types";
import type { GameStatus } from "@/lib/games/types";
import { itemImages } from "@/lib/db/items";

export default async function Featured() {
  const game = await getCurrentGame();

  if (!game) {
    return (
      <section className="ground-acid px-page flex min-h-[40vh] flex-col justify-center py-20">
        <Reveal>
          <p className="label">Games</p>
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
  const name = game.item?.name ?? game.title;
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
            {awaiting ? "Sold out — awaiting the draw" : "Open game"}
          </p>
          <h2 className="display mt-6 text-[clamp(2.25rem,4.5vw,4.5rem)]">
            {name.toUpperCase()}
          </h2>
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
                {awaiting ? "Every spot taken" : "Spots left"}
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
                  Nothing left to buy. The draw happens next — the winner
                  is posted on the game and announced on Instagram.
                </p>
                <Link href="/featured" className="cta-secondary mt-6">
                  See the board →
                </Link>
              </>
            ) : (
              <Link href="/featured" className="cta-primary">
                Take a spot
              </Link>
            )}
          </div>
        </Reveal>
      </div>

      {/* Right 40%: image bleeds off the right edge, full section height */}
      <div className="relative order-1 min-h-[50vh] bg-surface lg:order-2 lg:min-h-0">
        {image && (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
    </section>
  );
}
