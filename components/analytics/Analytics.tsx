"use client";

// GA4 loader plus App Router page_view tracking. The router does not
// reload between routes, so gtag's automatic page_view only ever fires
// once — we send the rest ourselves and turn the automatic one off to
// avoid double counting the landing page.
//
// Renders nothing at all when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset, so
// previews and local runs send no traffic to the client's property.

import { Suspense, useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { ANALYTICS_ENABLED, MEASUREMENT_ID, trackPageView } from "@/lib/analytics";

function PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The script's own config call covers the first view; skip it here.
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const query = searchParams.toString();
    trackPageView(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return null;
}

export default function Analytics() {
  if (!ANALYTICS_ENABLED) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}', { send_page_view: true });
        `}
      </Script>
      {/* useSearchParams needs a boundary or it opts the whole tree into
          client-side rendering. */}
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
    </>
  );
}
