import Link from "next/link";

/**
 * The way back from a detail screen.
 *
 * Every admin screen one level down carries one. The browser's back
 * button is not a substitute: the owner is on a phone, holding it in one
 * hand, and on iOS the back gesture competes with a horizontally
 * scrollable tab bar that sits at the top of every one of these pages.
 *
 * A 44px target, because it is tapped rather than clicked, and it names
 * where it goes — "Back" alone makes you remember how you arrived.
 */
export default function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="label -ml-1 inline-flex h-11 items-center gap-2 pr-3 text-muted transition-colors hover:text-bone"
    >
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
