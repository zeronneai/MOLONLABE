import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Service-role client for server actions ONLY. The key bypasses RLS and
// must never be imported into client components or exposed as
// NEXT_PUBLIC_*. Returns null when unset — callers fall back to the anon
// client, which the RLS insert policies still allow.
export function getServiceSupabase(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
