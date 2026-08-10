import { NextResponse, type NextRequest } from "next/server";
import { getSessionSupabase } from "@/lib/supabase/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  if (code) {
    const sb = await getSessionSupabase();
    if (sb) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}/admin/inventory`);
      }
    }
  }
  return NextResponse.redirect(`${origin}/admin?error=link`);
}
