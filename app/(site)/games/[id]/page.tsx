import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Reveal from "@/components/motion/Reveal";
import BuySpots from "@/components/games/BuySpots";
import {
  getGameById,
  getGameWinner,
  getRunningGames,
  getSpotCounts,
} from "@/lib/games/queries";
import { gameState, type GameStatus } from "@/lib/games/types";
import { ELIGIBILITY_SUMMARY } from "@/lib/games/rules";
import { dropPath, isDropId } from "@/lib/games/paths";
import { getWinners } from "@/lib/db/entries";
import { itemImages } from "@/lib/db/items";
import { formatUsd } from "@/lib/money";
import { demoStrippedTitle, isDemoGame } from "@/lib/surfaces";
import { SHOP_NAME } from "@/lib/brand";

// One drop, at its own address.
//
// Every card, button, cart line, receipt and email that means this drop
// links here by its id. There used to be one "current drop" page that
// showed whichever drop was newest, so with two open the older one could
// not be reached and a click on it opened the other.

// Never cached: the count is the whole point of the page and a stale one
// is worse than a slow one.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = isDropId(id) ? await getGameById(id) : null;
  if (!game) return { title: "Drop not found" };
  const title = demoStrippedTitle(game.title);
  const piece = game.item?.name;
  return {
    title,
    description: `${title}${piece && piece !== title ? `, featuring the ${piece}` : ""}. A drop at ${SHOP_NAME}, El Paso, TX: a written guide to the featured piece, with entry into its drawing.`,
    alternates: { canonical: dropPath(game.id) },
    // A demo drop is for showing the client, not for search results.
    ...(isDemoGame(game.title) ? { robots: { index: false, follow: false } } : {}),
  };
}

// Guarded because this is a public page and Intl throws on an invalid
// date rather than degrading.
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

export default async function DropPage({ params }: Props) {
  const { id } = await params;
  if (!isDropId(id)) notFound();
  const game = await getGameById(id);
  if (!game) notFound();

  const [counts, running, winner, winners] = await Promise.all([
    getSpotCounts(game.id, game.total_spots),
    getRunningGames(),
    game.status === "drawn" ? getGameWinner(game.id) : Promise.resolve(null),
    getWinners(),
  ]);
  const state = gameState({
    status: game.status as GameStatus,
    sold: counts.sold,
    totalSpots: counts.total,
  });
  const finished = state === "finished";
  const awaiting = state === "awaiting";
  const image = game.item ? itemImages(game.item)[0] : undefined;
  const title = demoStrippedTitle(game.title);
  const piece = game.item?.name ?? null;
  // Said once when the drop is named after its piece.
  const showPiece = piece && piece.trim().toUpperCase() !== title.trim().toUpperCase();
  const others = running.filter((g) => g.id !== game.id);

  return (
    <div className="pb-24 pt-[calc(72px+2rem)]" data-drop-page={game.id}>
      <section className="px-page">
        <Reveal>
          {isDemoGame(game.title) && (
            <p className="label mb-4 inline-block bg-amber px-3 py-1 text-ink">
              Demo, not a real drop
            </p>
          )}
          <p
            className={`label ${finished ? "text-muted" : awaiting ? "text-amber" : "text-acid"}`}
            data-drop-state
          >
            {finished
              ? `Drawn${winner ? ` ${fmtDate(winner.drawn_at)}` : ""}`
              : awaiting
                ? "Sold out, awaiting the draw"
                : "Open now"}
          </p>
          <h1
            className="display mt-6 max-w-3xl text-[clamp(2.25rem,5vw,4.5rem)]"
            data-drop-title
          >
            {title.toUpperCase()}
          </h1>
          {showPiece && (
            <p className="mt-4 text-lg" data-drop-piece>
              <span className="text-muted">Featured piece: </span>
              <strong className="font-extrabold tracking-[-0.02em]">{piece}</strong>
            </p>
          )}
          {game.description && (
            <p className="mt-6 max-w-xl leading-relaxed text-muted">
              {game.description}
            </p>
          )}
        </Reveal>

        {/* The scoreboard. The largest type on the page, because the
            count is the drop, not a statistic about it. */}
        <Reveal delay={60}>
          <div className="mt-14 flex flex-wrap items-end gap-x-16 gap-y-10 border-t hairline pt-10">
            <div>
              <div
                className={`display text-[clamp(4rem,12vw,8rem)] leading-[0.85] tabular-nums ${
                  finished ? "text-muted" : awaiting ? "text-amber" : "text-bone"
                }`}
              >
                {counts.remaining}
                <span className="text-muted">/{counts.total}</span>
              </div>
              <div className="label mt-4 text-muted">
                {finished || awaiting ? "Every guide sold" : "Guides left"}
              </div>
            </div>
            {!finished && (
              <div>
                <div className="display text-[clamp(2rem,5vw,3.5rem)] leading-none tabular-nums">
                  {formatUsd(game.spot_price_cents)}
                </div>
                <div className="label mt-4 text-muted">A guide</div>
              </div>
            )}
          </div>
        </Reveal>

        <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
          <div className="order-2 lg:order-1">
            <Reveal delay={100}>
              {finished ? (
                <div className="mt-10 border-l-2 border-muted pl-5" data-drop-winner>
                  <p className="display text-2xl">DRAWN.</p>
                  {winner && (
                    <p className="mt-3 text-sm">
                      <span className="text-muted">Won by </span>
                      <strong>{winner.display_name}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <BuySpots
                  gameId={game.id}
                  dropTitle={title}
                  spotPriceCents={game.spot_price_cents}
                  remaining={game.status === "open" ? counts.remaining : 0}
                  dropTitles={Object.fromEntries(
                    running.map((g) => [g.id, demoStrippedTitle(g.title)]),
                  )}
                />
              )}
            </Reveal>
          </div>
          <div className="order-1 mt-12 lg:order-2 lg:mt-10">
            {image && (
              <div className="relative aspect-[4/3] bg-surface">
                <Image
                  src={image}
                  alt={piece ?? title}
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className={`object-cover ${finished ? "opacity-60 grayscale" : ""}`}
                  priority
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* The other drops, each by name and to its own page, so no drop is
          reachable only by knowing its address. */}
      {others.length > 0 && (
        <section className="px-page mt-20 border-t hairline pt-10" data-other-drops>
          <h2 className="label text-acid">
            {others.length === 1 ? "Another drop running" : "Other drops running"}
          </h2>
          <ul className="mt-6 space-y-3">
            {others.map((g) => (
              <li key={g.id}>
                <Link
                  href={dropPath(g.id)}
                  className="font-extrabold tracking-[-0.02em] underline decoration-1 underline-offset-4 hover:text-acid"
                >
                  {demoStrippedTitle(g.title)}
                </Link>
                {g.item?.name && g.item.name !== g.title && (
                  <span className="text-sm text-muted"> · {g.item.name}</span>
                )}
              </li>
            ))}
          </ul>
          <Link href="/games" className="cta-secondary mt-6 inline-block">
            All drops →
          </Link>
        </section>
      )}

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
