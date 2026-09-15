import { getServiceSupabase } from "@/lib/supabase/service";
import { readGuide } from "@/lib/guides/build";
import { guideFileName } from "@/lib/guides/storage";
import { SHOP_PHONE_DISPLAY } from "@/lib/brand";

// The buyer's copy of the guide.
//
// Authenticated exactly the way the receipt page is: order number plus
// the random token issued at checkout, both required, read with the
// service role because orders are unreadable with the public key. There
// is no account and no session behind any of this; the token IS the
// credential. Guessing an order number gets a 404.
//
// A signed storage URL was the other option and this is better. A signed
// URL is a second credential with its own lifetime, handed out beside the
// one the buyer already has, and it goes on working after the receipt
// link it came from has expired. Streaming the bytes through here means
// there is one door, one expiry, and one thing to reason about.
//
// It also builds on demand. `readGuide` renders and stores the guide if
// the stored copy is missing or out of date, so a build that failed
// during checkout — or an owner who fixed a typo an hour ago — resolves
// itself the next time somebody follows the link.

export const dynamic = "force-dynamic";

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ order: string }> },
) {
  const { order: fileName } = await params;
  const orderNumber = fileName.replace(/\.pdf$/i, "");
  const token = new URL(request.url).searchParams.get("t");
  if (!orderNumber || !token) return notFound();

  const sb = getServiceSupabase();
  if (!sb) return notFound();

  const { data: order } = await sb
    .from("orders")
    .select("id, game_id, confirmation_expires_at")
    .eq("order_number", orderNumber)
    .eq("confirmation_token", token)
    .maybeSingle();
  if (!order) return notFound();

  // The same expiry the receipt honours. A guide that outlived the
  // receipt it was linked from would be a quiet second copy of the order
  // with a longer life than the order's own link.
  if (
    order.confirmation_expires_at &&
    new Date(order.confirmation_expires_at) < new Date()
  ) {
    return notFound();
  }

  // A merchandise order has no game and therefore no guide. Not an
  // error — there is simply nothing at this address for that order.
  if (!order.game_id) return notFound();

  const guide = await readGuide(sb, order.game_id);
  if (!guide.ok) {
    console.error(`guide unavailable for order ${orderNumber}: ${guide.message}`);
    // Deliberately not a 404. The reader has a valid token, so telling
    // them the file is missing would send them looking for a mistake
    // they did not make. They get a person to call instead.
    return new Response(
      `We can't produce your guide right now. Nothing is wrong with your order — call the shop on ${SHOP_PHONE_DISPLAY} and quote ${orderNumber}.`,
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const { data: game } = await sb
    .from("games")
    .select("item:items(name)")
    .eq("id", order.game_id)
    .maybeSingle();
  const itemName =
    (game?.item as { name?: string } | null)?.name ?? "molon-labe";

  return new Response(new Uint8Array(guide.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(guide.bytes.length),
      // `inline` so a phone opens it rather than dropping it in Files.
      "content-disposition": `inline; filename="${guideFileName(itemName)}"`,
      // Nothing about a paid document belongs in a shared cache, and the
      // URL carries a credential in its query string.
      "cache-control": "private, no-store",
    },
  });
}
