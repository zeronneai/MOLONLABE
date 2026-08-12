"use client";

// view_item, fired once per item view. A client component because the
// detail page itself is server-rendered and gtag lives in the browser.

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

export default function TrackView({
  slug,
  name,
  category,
}: {
  slug: string;
  name: string;
  category: string;
}) {
  const sent = useRef("");
  useEffect(() => {
    if (sent.current === slug) return; // survives strict-mode double effects
    sent.current = slug;
    track("view_item", { item_slug: slug, item_name: name, category });
  }, [slug, name, category]);
  return null;
}
