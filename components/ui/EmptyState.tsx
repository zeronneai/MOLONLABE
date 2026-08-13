// Empty states. Every list here can be empty on day one, and "No results
// found" is the sound of a template. These read like the shop talks:
// short, declarative, and they always say what to do next.

import Link from "next/link";

export default function EmptyState({
  label,
  headline,
  body,
  action,
}: {
  label: string;
  headline: string;
  body?: string;
  action?: { href: string; text: string };
}) {
  return (
    <div className="border-t hairline py-20">
      <p className="label text-acid">{label}</p>
      <p className="display mt-5 max-w-[24ch] text-[clamp(1.75rem,3.5vw,2.75rem)]">
        {headline}
      </p>
      {body && <p className="mt-5 max-w-[46ch] text-sm leading-relaxed text-muted">{body}</p>}
      {action && (
        <Link href={action.href} className="cta-primary mt-9">
          {action.text}
        </Link>
      )}
    </div>
  );
}
