import { NextResponse } from "next/server";
import { getSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/** Quotes every cell and doubles any quote inside it. */
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * The spot ledger, for the owner.
 *
 * Behind the admin session, not the service role — if the session is not
 * valid there is no export. Full names and emails are in here because
 * this is the shop's own record of who bought what; it is the one place
 * they appear together, and it never leaves the admin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await getSessionSupabase();
  if (!sb) return new NextResponse("Not signed in", { status: 401 });

  const [{ data: game }, { data: spots }] = await Promise.all([
    sb.from("games").select("title").eq("id", id).maybeSingle(),
    sb
      .from("game_spots")
      .select("spot_number, status, first_name, last_name, email, phone, show_name, sold_at")
      .eq("game_id", id)
      .eq("status", "sold")
      .order("spot_number"),
  ]);

  const header = [
    "Spot", "First name", "Last name", "Email", "Phone", "On public board", "Sold at",
  ];
  const rows = (spots ?? []).map((s) => [
    s.spot_number,
    s.first_name,
    s.last_name,
    s.email,
    s.phone,
    s.show_name ? "yes" : "no",
    s.sold_at,
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");

  const slug = (game?.title ?? "game")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-spots.csv"`,
      "cache-control": "no-store",
    },
  });
}
