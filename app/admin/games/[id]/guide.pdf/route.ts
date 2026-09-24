import { NextResponse } from "next/server";
import { getStaff } from "@/lib/admin/staff";
import { logActivity } from "@/lib/admin/audit";
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
 * TWO CLIENTS, ON PURPOSE. The session client answers "is this a member
 * of staff?", and nothing else; if it cannot, there is no preview. The
 * service client then does the work, because the guides bucket is private
 * and has no policies — see lib/guides/storage.ts. Using the session
 * client for the storage read would mean adding a policy for the
 * authenticated role, which is the one thing that bucket must not have.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // A staff row, not merely a signed-in account. What follows runs with
  // the service role, which row level security does not apply to, so
  // this check is the whole of the protection. It used to accept any
  // account that could sign in.
  const who = await getStaff();
  if (!who.ok) {
    return new NextResponse(
      who.reason === "signed-out" ? "Not signed in" : "No access",
      { status: who.reason === "signed-out" ? 401 : 403 },
    );
  }

  const sb = getServiceSupabase();
  if (!sb) return new NextResponse("Storage is not configured.", { status: 503 });

  // `?rebuild=1` — the remedy for a guide that came out short.
  //
  // A guide is only rebuilt when its inputs change, which is right for
  // the ordinary case and useless for this one: a photograph that failed
  // to fetch leaves the inputs identical, so nothing would ever try
  // again. Clearing the fingerprint is what makes the next read build it.
  //
  // Owner and manager both, since the manager writes the guide sections.
  // It does not delete anything: the stored guide keeps serving until a
  // new one replaces it.
  if (new URL(request.url).searchParams.get("rebuild") === "1") {
    const { data: rebuilt } = await sb
      .from("games")
      .update({ guide_fingerprint: null })
      .eq("id", id)
      .select("title")
      .maybeSingle();
    // Through the session client, so the database stamps the name.
    await logActivity(who.staff.sb, who.staff, {
      action: "update", entity: "game", entityId: id,
      entityLabel: rebuilt?.title ?? null, field: "guide", after: "rebuilt",
    });
  }

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
