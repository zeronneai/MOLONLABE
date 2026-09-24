import { NextResponse } from "next/server";
import { OWNER_ONLY, getStaff } from "@/lib/admin/staff";

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
 *
 * OWNER ONLY. Bulk export of the entrant list is on the manager's
 * restricted list. Be clear about what that does and does not stop: a
 * manager can read the same names on the game page, because he needs
 * them to run the draw and contact the winner. What he cannot do is walk
 * out with the whole list as a file. The database cannot tell a download
 * from a page view, so this refusal is the server's alone.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const who = await getStaff();
  if (!who.ok) return new NextResponse("Not signed in", { status: 401 });
  if (who.staff.role !== "owner") {
    console.warn(`Refused for a manager (${who.staff.name}): buyer list export`);
    return new NextResponse(OWNER_ONLY, {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const { sb } = who.staff;

  const [{ data: game }, { data: spots }] = await Promise.all([
    sb.from("games").select("title").eq("id", id).maybeSingle(),
    sb
      .from("game_spots")
      .select("spot_number, status, first_name, last_name, email, phone, sold_at")
      .eq("game_id", id)
      .eq("status", "sold")
      .order("spot_number"),
  ]);

  // Seven headings over six values used to put "Sold at" under "On
  // public board", a column left behind when the board opt-in was
  // removed. One heading per value now.
  const header = [
    "Guide number", "First name", "Last name", "Email", "Phone", "Sold at",
  ];
  const rows = (spots ?? []).map((s) => [
    s.spot_number,
    s.first_name,
    s.last_name,
    s.email,
    s.phone,
    s.sold_at,
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");

  const slug = (game?.title ?? "drop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-guides.csv"`,
      "cache-control": "no-store",
    },
  });
}
