// Shared shape for the 404 and the 500 so they are unmistakably the same
// site: label, huge headline, one line of plain explanation, and always a
// way back. Used by app/not-found.tsx, app/error.tsx and app/global-error.tsx.

import Link from "next/link";
import { LOGO_URL, SHOP_PHONE_DISPLAY, SHOP_PHONE_HREF } from "@/lib/brand";

export default function ErrorScreen({
  code,
  headline,
  body,
  primary,
  onRetry,
  retryLabel = "Try again",
}: {
  code: string;
  headline: React.ReactNode;
  body: string;
  primary?: { href: string; text: string };
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="px-page flex min-h-svh flex-col justify-center pb-24 pt-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="" className="h-10 w-auto" />
      <p className="label mt-10 text-acid">{code}</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">{headline}</h1>
      <p className="mt-6 max-w-[46ch] leading-relaxed text-muted">{body}</p>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        {onRetry && (
          <button type="button" onClick={onRetry} className="cta-primary control-go">
            {retryLabel}
          </button>
        )}
        {primary && (
          <Link
            href={primary.href}
            className={`cta-primary${onRetry ? "" : " control-go"}`}
          >
            {primary.text}
          </Link>
        )}
        <Link href="/" className="cta-primary">
          Home
        </Link>
      </div>

      {/* A phone number is the one route out that never 404s. */}
      <p className="mt-10 text-sm text-muted">
        Still stuck?{" "}
        <a href={SHOP_PHONE_HREF} className="text-bone underline underline-offset-4 hover:text-acid">
          {SHOP_PHONE_DISPLAY}
        </a>
      </p>
    </div>
  );
}
