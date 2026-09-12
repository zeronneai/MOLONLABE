import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/motion/Reveal";
import { getCaseItems, itemImages } from "@/lib/db/items";
import { getGameItemIds } from "@/lib/games/queries";

/**
 * The third action: ask about a firearm.
 *
 * Deliberately the quietest of the three sections and the only one with
 * no number on it. There is no price, no count and no cart — the whole
 * point is that this is a conversation at a counter, not a transaction,
 * and a section that looked like the other two would say the opposite.
 *
 * Three items, because it is a taste. The case itself is a page.
 */
export default async function CaseSection() {
  const inGames = await getGameItemIds();
  const items = (await getCaseItems(inGames)).slice(0, 3);

  return (
    <section className="ground-neutral">
      <div className="px-page py-24">
        <Reveal>
          <p className="label">In the case</p>
          <h2 className="display mt-6 max-w-3xl text-[clamp(2rem,4vw,3.5rem)]">
            ASK ABOUT ANY OF IT
          </h2>
          <p className="mt-6 max-w-[52ch] text-muted">
            Firearms on hand at the shop. Nothing here goes in a basket —
            every transfer happens at the counter, with the paperwork and
            the background check. Tell us what you are after.
          </p>
        </Reveal>

        {items.length > 0 ? (
          <>
            <Reveal delay={60}>
              <ul className="mt-12 grid gap-px border hairline bg-[color-mix(in_srgb,var(--color-bone)_18%,transparent)] sm:grid-cols-3">
                {items.map((item) => {
                  const image = itemImages(item)[0] ?? null;
                  return (
                    <li key={item.id} className="bg-surface-2">
                      <Link href={`/inventory/${item.slug}`} className="group block">
                        <div className="relative aspect-[4/3] overflow-hidden">
                          {image ? (
                            <Image
                              src={image}
                              alt={item.name}
                              fill
                              sizes="(min-width: 640px) 33vw, 100vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <span className="label">No photograph yet</span>
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          {item.brand && <p className="label">{item.brand}</p>}
                          <p className="display mt-2 text-lg">
                            {item.name.toUpperCase()}
                          </p>
                          {/* Where a price would be on a shop card. Saying
                              what happens instead is more useful than
                              leaving a gap the eye reads as missing. */}
                          <p className="mt-3 text-sm text-muted">
                            Ask at the counter
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
            <div className="mt-10">
              <Link href="/in-the-case" className="cta-secondary">
                Everything in the case →
              </Link>
            </div>
          </>
        ) : (
          <Reveal delay={60}>
            <div className="mt-12 max-w-[52ch] border-l-2 border-acid pl-6">
              <p className="text-muted">
                Nothing is listed in the case right now. Stock moves, and
                this only shows what is genuinely on hand.
              </p>
              <Link href="/visit" className="cta-secondary mt-8">
                Come and see us →
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
