import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/motion/Reveal";
import { getAllGames } from "@/lib/games/queries";
import { itemImages } from "@/lib/db/items";
import { demoStrippedTitle, isDemoGame } from "@/lib/surfaces";

const stamp = (iso: string | null) => {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(at);
};

/**
 * Games that filled and drew.
 *
 * This is the social proof section, and it works by evidence rather than
 * adjectives: "100 of 100 · drawn Sept 12" tells a visitor the thing
 * actually happens, which no sentence we could write would achieve. So
 * the numbers are set large and the copy stays out of the way.
 *
 * It starts empty on purpose. The four firearms in the catalogue are
 * items, not games — they were never in a game, have no spots and no
 * winner, so there is nothing to move here. The empty state says that
 * plainly rather than pretending the section is broken, and the admin has
 * a one-click demo game for showing the client what it looks like full.
 */
export default async function PastGames() {
  const { finished } = await getAllGames();

  return (
    <section className="ground-neutral">
      <div className="px-page py-24">
        <Reveal>
          <p className="label">Past games</p>
          <h2 className="display mt-6 max-w-3xl text-[clamp(2rem,4vw,3.5rem)]">
            ALREADY DRAWN
          </h2>
        </Reveal>

        {finished.length === 0 ? (
          <Reveal delay={60}>
            <div className="mt-12 max-w-[52ch] border-l-2 border-acid pl-6">
              <p className="text-muted">
                No game has been drawn yet. When one fills and the winner is
                picked, it lands here — the prize, how many spots sold, and
                the date.
              </p>
              <p className="mt-4 text-muted">
                This section fills itself. Nothing needs doing.
              </p>
              <Link href="/games" className="cta-secondary mt-8">
                See what&apos;s running →
              </Link>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal delay={60}>
              <ul className="mt-12 border-t hairline">
                {finished.slice(0, 4).map((g) => {
                  const image = g.item ? itemImages(g.item)[0] ?? null : null;
                  return (
                    <li
                      key={g.id}
                      className="flex items-center gap-5 border-b hairline py-6"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-surface-sunken sm:h-20 sm:w-20">
                        {image && (
                          <Image
                            src={image}
                            alt=""
                            fill
                            sizes="80px"
                            className="object-cover opacity-70 grayscale"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="display truncate text-lg">
                          {(g.item?.name ?? demoStrippedTitle(g.title)).toUpperCase()}
                        </p>
                        <p className="label mt-1">
                          {isDemoGame(g.title) && (
                            <span className="text-amber">DEMO · </span>
                          )}
                          {stamp(g.drawnAt) ?? "Drawn"}
                          {g.winnerName ? ` · ${g.winnerName}` : ""}
                        </p>
                      </div>
                      {/* No price and no cart: this is a record of
                          something that has already happened. */}
                      <p className="display shrink-0 text-xl sm:text-2xl">
                        {g.sold}
                        <span className="opacity-50"> / {g.totalSpots}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
            <div className="mt-10">
              <Link href="/games" className="cta-secondary">
                All games →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
