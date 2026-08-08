// Typed GA4 wrapper — PROJECT_BRIEF.md section 11. Events cannot drift:
// add them here or they don't exist. The gtag script itself ships in the
// analytics step; until then track() is a safe no-op.

type EventParams = {
  view_item: { item_slug: string; item_name: string; category: string };
  inquiry_submit: { type: string; item_slug?: string };
  click_to_call: { source: "header" | "detail" | "footer" | "sticky" };
  whatsapp_click: { source: "header" | "detail" | "footer" | "sticky" };
  entry_start: { campaign_id: string };
  entry_submit: { campaign_id: string };
  transfer_submit: Record<string, never>;
  video_play: { item_slug: string };
  intro_completed: { hits: number; elapsed_ms: number };
  intro_skipped: { elapsed_ms: number };
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track<K extends keyof EventParams>(
  event: K,
  params: EventParams[K],
): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", event, params);
}
