import { redirect } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";

// Auth depends on cookies at request time; never let this prerender.
export const dynamic = "force-dynamic";

// Authenticated visits land on inventory; unauthenticated ones see the
// login screen rendered by the layout.
export default async function AdminIndex() {
  const sb = await getSessionSupabase();
  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) redirect("/admin/inventory");
  }
  return null;
}
