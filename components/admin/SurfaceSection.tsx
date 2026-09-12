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
  count,
  add,
  children,
}: {
  surface: Surface;
  count: number;
  add?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${SURFACE_GROUND[surface]} admin-surface`}
      aria-labelledby={`surface-${surface}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 id={`surface-${surface}`} className="display text-xl">
            {SURFACE_LABEL[surface].toUpperCase()}
          </h2>
          <p className="label mt-1">
            {count} {count === 1 ? "item" : "items"}
          </p>
        </div>
        {add && (
          <Link href={add.href} className="cta-primary control-go !h-11 !px-5">
            {add.label}
          </Link>
        )}
      </div>

      <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-muted">
        {SURFACE_BLURB[surface]}
      </p>

      <div className="mt-6 border-t hairline">{children}</div>
    </section>
  );
}
