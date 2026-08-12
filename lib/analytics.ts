// Typed GA4 wrapper. Events cannot drift: add them here or they don't
// exist. Every call site is type-checked against these parameter shapes.
//
// KEY_EVENTS below is the list the client marks as key events in the GA4
// UI (Admin -> Events -> "Mark as key event"). That flag lives in the GA4
// property, not in code — nothing we ship can set it — so this list is
// the record of which ones matter. See docs/analytics.md.

type EventParams = {
  view_item: { item_slug: string; item_name: string; category: string };
  inquiry_submit: { type: string; item_slug?: string };
  click_to_call: { source: "header" | "detail" | "footer" | "sticky" };
  whatsapp_click: { source: "header" | "detail" | "footer" | "sticky" };
  entry_start: { campaign_id: string };
  entry_submit: { campaign_id: string; method: "free" | "purchase" };
  transfer_submit: Record<string, never>;
  video_play: { item_slug: string };
  intro_completed: { hits: number; elapsed_ms: number };
  intro_skipped: { elapsed_ms: number };
};

export type AnalyticsEvent = keyof EventParams;

/** The events that represent business outcomes rather than browsing. */
export const KEY_EVENTS: AnalyticsEvent[] = [
  "inquiry_submit",
  "click_to_call",
  "entry_submit",
  "transfer_submit",
];

export const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const ANALYTICS_ENABLED = MEASUREMENT_ID.startsWith("G-");

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track<K extends AnalyticsEvent>(
  event: K,
  params: EventParams[K],
): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", event, params);
}

/** Manual page_view, since the App Router does not reload between routes. */
export function trackPageView(path: string): void {
  if (typeof window === "undefined" || !ANALYTICS_ENABLED) return;
  window.gtag?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
