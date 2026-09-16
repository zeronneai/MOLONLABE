import Link from "next/link";
import { SURFACE_BLURB, SURFACE_GROUND, SURFACE_LABEL, type Surface } from "@/lib/surfaces";

/**
 * One of the three kinds of thing the owner manages.
 *
 * The ground is the same one customers see on the home page for the same
 * surface, which is the whole point: looking at the green band in here he
 * should know it is the same thing as the green band out there, without
 * being told.
 *
 * The blurb is not decoration. The owner adds a product every few weeks
 * at most, and the question he actually has is "which of these is a box
 * of 9mm" — so the answer sits above the list in his language rather than
 * in a help page nobody opens.
 */
export default function SurfaceSection({
  surface,
  id = surface,
  heading,
  blurb,
  count,
  unit = "item",
  add,
  children,
}: {
  surface: Surface;
  /**
   * The DOM id, when a page shows two sections on the same ground.
   *
   * Two sections both called `surface-games` is a duplicate id, which is
   * an accessibility bug as well as a confusing one — `aria-labelledby`
   * on the second resolves to the first heading.
   */
  id?: string;
  /**
   * A heading other than the surface's own name.
   *
   * The prize list on the inventory page sits on the Games ground
   * deliberately — it is the same colour as the band customers see — but
   * it is a list of ITEMS, not of games, and calling it "Games" alongside
   * the actual list of games made the two look like one thing shown
   * twice.
   */
  heading?: string;
  /** A blurb other than the surface's own, for the same reason. */
  blurb?: string;
  count: number;
  /**
   * What `count` is counting. "item" everywhere except the Games list,
   * which counts games — it read "1 item" directly above a list of
   * items that were something else entirely.
   */
  unit?: string;
  add?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${SURFACE_GROUND[surface]} admin-surface`}
      aria-labelledby={`surface-${id}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 id={`surface-${id}`} className="display text-xl">
            {(heading ?? SURFACE_LABEL[surface]).toUpperCase()}
          </h2>
          <p className="label mt-1">
            {count} {count === 1 ? unit : `${unit}s`}
          </p>
        </div>
        {add && (
          <Link href={add.href} className="cta-primary control-go !h-11 !px-5">
            {add.label}
          </Link>
        )}
      </div>

      <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted">
        {blurb ?? SURFACE_BLURB[surface]}
      </p>

      <div className="mt-6 border-t hairline">{children}</div>
    </section>
  );
}
