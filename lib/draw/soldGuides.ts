// The sold guides of one drop, with whether each buyer agreed to be named
// on the broadcast. Read by the draw presentation (to build the roster)
// and by the admin drop page (to say how many buyers will appear by guide
// number instead of by name), so the two can never disagree.
//
// Server only: it reads emails and order terms, which never reach a page
// that is filmed.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { hasBroadcastConsent } from "@/lib/games/terms";

export type SoldGuide = {
  spot_number: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  broadcast_consent: boolean;
};

export async function loadSoldGuides(
  sb: SupabaseClient<Database>,
  gameId: string,
): Promise<{ ok: true; guides: SoldGuide[] } | { ok: false; error: string }> {
  const { data: spots, error } = await sb
    .from("game_spots")
    .select("spot_number, first_name, last_name, email, order_id")
    .eq("game_id", gameId)
    .eq("status", "sold")
    .order("spot_number");
  if (error) return { ok: false, error: error.message };

  const orderIds = [...new Set((spots ?? []).map((s) => s.order_id).filter((id): id is string => Boolean(id)))];
  const agreed = new Set<string>();
  // In batches, because a large drop can have hundreds of orders and a
  // single `in (…)` that long is a URL the API may refuse.
  for (let i = 0; i < orderIds.length; i += 150) {
    const { data: orders, error: orderError } = await sb
      .from("orders")
      .select("id, game_terms_text")
      .in("id", orderIds.slice(i, i + 150));
    // If the orders cannot be read, there is no roster: guessing who
    // agreed would either name somebody who did not or hide somebody who
    // did, and neither belongs in the video.
    if (orderError) return { ok: false, error: orderError.message };
    for (const o of orders ?? []) if (hasBroadcastConsent(o.game_terms_text)) agreed.add(o.id);
  }

  return {
    ok: true,
    guides: (spots ?? []).map((s) => ({
      spot_number: s.spot_number,
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
      broadcast_consent: s.order_id ? agreed.has(s.order_id) : false,
    })),
  };
}
