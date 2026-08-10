import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SESSION_MAX_AGE } from "./config";

// Cookie-based client carrying the owner's session. Use in admin server
// components, server actions, and route handlers. RLS runs as
// `authenticated`.
export async function getSessionSupabase(): Promise<SupabaseClient<Database> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookieOptions: { maxAge: SESSION_MAX_AGE },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component render — cookies are read-only
          // there; middleware handles the refresh write instead.
        }
      },
    },
  });
}
