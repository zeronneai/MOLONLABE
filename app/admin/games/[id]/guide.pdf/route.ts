import { NextResponse } from "next/server";
import { getSessionSupabase } from "@/lib/supabase/session";
import { getServiceSupabase } from "@/lib/supabase/service";
import { readGuide } from "@/lib/guides/build";
import { guideFileName } from "@/lib/guides/storage";

export const dynamic = "force-dynamic";

/**
 * The owner's preview of the guide.
 *
 * He is selling this. He should be able to look at it before a customer
 * does, and again after he edits one of the three sections — it builds on
 * demand, so opening this after a change shows the change.
 *
 * TWO CLIENTS, ON PURPOSE. The session client answers "is this the
 * owner?", and nothing else; if it cannot, there is no preview. The
 * service client then does the work, because the guides bucket is private
 * and has no policies — see lib/guides/storage.ts. Using the session
 * client for the storage read would mean adding a policy for the
 * authenticated role, which is the one thing that bucket must not have.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSessionSupabase();
  if (!session) return new NextResponse("Not signed in", { status: 401 });
  const { data: me } = await session.auth.getUser();
  if (!me?.user) return new NextResponse("Not signed in", { status: 401 });

  const sb = getServiceSupabase();
  if (!sb) return new NextResponse("Storage is not configured.", { status: 503 });

  const guide = await readGuide(sb, id);
  if (!guide.ok) {
    // The owner is the person who can fix this, so he gets the actual
    // reason rather than a status code — nine times in ten it is that
    // one of his three sections is empty.
    return new NextResponse(guide.message, {
      status: 409,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const { data: game } = await sb
    .from("games")
    .select("item:items(name)")
    .eq("id", id)
    .maybeSingle();
  const itemName = (game?.item as { name?: string } | null)?.name ?? "guide";

  return new NextResponse(new Uint8Array(guide.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${guideFileName(itemName)}"`,
      "cache-control": "private, no-store",
    },
  });
}
