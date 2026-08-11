"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let client: SupabaseClient<Database> | null | undefined;

// Browser client for the admin: magic-link sign-in and storage uploads
// with the owner's session.
export function getBrowserSupabase(): SupabaseClient<Database> | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  client = url && key ? createBrowserClient<Database>(url, key) : null;
  return client;
}
