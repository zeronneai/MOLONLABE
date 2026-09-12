import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import EmptyState from "@/components/ui/EmptyState";
import BuySpots from "@/components/games/BuySpots";
import SpotBoard from "@/components/games/SpotBoard";
import { getCurrentGame, getBoard, getSpotCounts } from "@/lib/games/queries";
import { ELIGIBILITY_SUMMARY } from "@/lib/games/rules";
import { getWinners } from "@/lib/db/entries";
import { itemImages } from "@/lib/db/items";
import { formatUsd } from "@/lib/money";

export const metadata: Metadata = {
  title: "The game",
  description:
    "The current game at Molon Labe Firearms x SunCity Outdoors, El Paso, TX.",
};

// Never cached: the spot count is the whole point of the page and a
// stale one is worse than a slow one.
export const dynamic = "force-dynamic";

// Guarded because this is a public page and Intl throws on an invalid
// date rather than degrading. drawn_at is not-null with a default, so a
// bad value should be impossible — but one unparseable timestamp taking
// down the whole featured page is a poor trade against returning an
// empty string for that one line.
const fmtDate = (iso: string) => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(at);
};

export default async function FeaturedPage() {
  const game = await getCurrentGame();
  const winners = await getWinners();

  if (!game) {
    return (
      <div className="px-page pb-24 pt-[calc(72px+4rem)]">
        <EmptyState
          label="The game"
          headline="NOTHING RUNNING RIGHT NOW."
          body="The next game is announced on Instagram first. Follow @molonlabe.fa or check back."
        />
        {winners.length > 0 && <PastWinners winners={winners} />}
      </div>
    );
  }

  const [counts, board] = await Promise.all([
    getSpotCounts(game.id, game.total_spots),
    getBoard(game.id),
  ]);
  const image = game.item ? itemImages(game.item)[0] : undefined;
  const name = game.item?.name ?? game.title;
  const soldOut = counts.remaining === 0;

  return (
    <div className="pb-24 pt-[calc(72px+2rem)]">
      <section className="px-page">
        <Reveal>
          <p className="label text-acid">
            {soldOut ? "Sold out — awaiting the draw" : "Open now"}
          </p>
          <h1 className="display mt-6 max-w-3xl text-[clamp(2.25rem,5vw,4.5rem)]">
            {name.toUpperCase()}
          </h1>
          {game.description && (
            <p className="mt-6 max-w-xl leading-relaxed text-muted">
              {game.description}
            </p>
          )}
        </Reveal>

        {/* The scoreboard. The largest type on the page, because the
            count IS the game — not a statistic about it. */}
        <Reveal delay={60}>
          <div className="mt-14 flex flex-wrap items-end gap-x-16 gap-y-10 border-t hairline pt-10">
            <div>
              <div
                className={`display text-[clamp(4rem,12vw,8rem)] leading-[0.85] tabular-nums ${
                  soldOut ? "text-amber" : "text-bone"
                }`}
              >
                {counts.remaining}
                <span className="text-muted">/{counts.total}</span>
              </div>
              <div className="label mt-4 text-muted">
                {soldOut ? "All spots gone" : "Spots left"}
              </div>
            </div>
            <div>
              <div className="display text-[clamp(2rem,5vw,3.5rem)] leading-none tabular-nums">
                {formatUsd(game.spot_price_cents)}
              </div>
              <div className="label mt-4 text-muted">A spot</div>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
          <div className="order-2 lg:order-1">
            <Reveal delay={100}>
              <BuySpots
                gameId={game.id}
                spotPriceCents={game.spot_price_cents}
                remaining={counts.remaining}
              />
            </Reveal>
          </div>
          <div className="order-1 mt-12 lg:order-2 lg:mt-10">
            {image && (
              <div className="relative aspect-[4/3] bg-surface">
                <Image
                  src={image}
                  alt={name}
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </div>
        </div>

        <SpotBoard spots={board} total={counts.total} />
      </section>

      {winners.length > 0 && (
        <div className="px-page">
          <PastWinners winners={winners} />
        </div>
      )}

      <div className="px-page mt-20 border-t hairline pt-8">
        <Link href="/sweepstakes-rules" className="cta-secondary">
          Official rules
        </Link>
        <p className="mt-2 max-w-[60ch] text-xs text-muted">
          {ELIGIBILITY_SUMMARY}
        </p>
      </div>
    </div>
  );
}

function PastWinners({
  winners,
}: {
  winners: {
    id: string;
    display_name: string;
    photo_url: string | null;
    drawn_at: string;
  }[];
}) {
  return (
    <section className="mt-24">
      <h2 className="label text-acid">Past winners</h2>
      <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
        {winners.map((w) => (
          <li key={w.id}>
            <div className="aspect-square bg-surface-2">
              {w.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w.photo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <p className="mt-3 font-extrabold tracking-[-0.02em]">
              {w.display_name}
            </p>
            <p className="label mt-1 text-muted">{fmtDate(w.drawn_at)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
