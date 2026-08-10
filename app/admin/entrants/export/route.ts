import { NextResponse, type NextRequest } from "next/server";
import { getSessionSupabase } from "@/lib/supabase/session";

function csvCell(value: string | number | null): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const sb = await getSessionSupabase();
  if (!sb) return new NextResponse("Unavailable", { status: 503 });
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const campaignId = request.nextUrl.searchParams.get("campaign");
  let query = sb.from("entrants").select("*").order("created_at", { ascending: true });
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data: entrants, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });

  const header = "first_name,last_name,email,phone,entries,source,created_at";
  const rows = (entrants ?? []).map((e) =>
    [
      csvCell(e.first_name),
      csvCell(e.last_name),
      csvCell(e.email),
      csvCell(e.phone),
      csvCell(e.entry_count),
      csvCell(e.source),
      csvCell(e.created_at),
    ].join(","),
  );

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="entrants${campaignId ? `-${campaignId.slice(0, 8)}` : ""}.csv"`,
    },
  });
}
