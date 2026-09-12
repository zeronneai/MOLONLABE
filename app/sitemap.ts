import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";
import { getSupabase } from "@/lib/supabase/server";
import { logDbError } from "@/lib/db/log";

// Rebuilt per request: inventory turns over, and a stale sitemap pointing
// at sold-and-archived items is worse than none.
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.9, changeFrequency: "weekly" },
  { path: "/games", priority: 0.9, changeFrequency: "daily" },
  { path: "/in-the-case", priority: 0.9, changeFrequency: "daily" },
  { path: "/featured", priority: 0.8, changeFrequency: "daily" },
  { path: "/transfers", priority: 0.6, changeFrequency: "monthly" },
  { path: "/services", priority: 0.6, changeFrequency: "monthly" },
  { path: "/visit", priority: 0.6, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const sb = getSupabase();
  if (!sb) return entries;

  // Archived items are excluded by RLS already; the filter is belt and
  // braces so a policy change can't quietly publish them.
  const { data, error } = await sb
    .from("items")
    .select("slug, updated_at, status")
    .neq("status", "hidden")
    .order("updated_at", { ascending: false });
  if (error) {
    logDbError("sitemap items", error);
    return entries;
  }

  for (const item of data ?? []) {
    entries.push({
      url: `${SITE_URL}/inventory/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
