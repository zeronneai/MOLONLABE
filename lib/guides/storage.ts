import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Where a built guide lives.
//
// The bucket is PRIVATE. Nothing reaches it with the anonymous key and
// nothing reaches it with the owner's session either — every read and
// write here goes through the service role, which bypasses storage row
// level security, and the two doors into it are guarded by the app:
//
//   /guide          checks the order's confirmation token, the same
//                   credential the receipt page checks
//   /admin/…/guide  checks the owner's session
//
// So the bucket needs no policies, and giving it one would be the way to
// undo all of that at once. See 20260926100000_game_guides.sql.

export const GUIDE_BUCKET = "game-guides";

/**
 * One object per game, overwritten in place.
 *
 * Versioning the path by fingerprint was the alternative. It would leave
 * every superseded guide in the bucket for ever, and there is nothing
 * that would ever read one — the fingerprint on the row is what decides
 * whether the bytes are current, and a stale object is only confusing.
 */
export function guideObjectPath(gameId: string): string {
  return `${gameId}.pdf`;
}

/** What a browser should call the file it just downloaded. */
export function guideFileName(itemName: string): string {
  const stem =
    itemName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "guide";
  return `${stem}-guide.pdf`;
}

type Service = SupabaseClient<Database>;

export async function putGuide(
  sb: Service,
  path: string,
  bytes: Buffer,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await sb.storage.from(GUIDE_BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    // Overwrites. Without this a regenerated guide fails with "resource
    // already exists" and the row keeps pointing at the old bytes while
    // its fingerprint says they are current — the worst of both.
    upsert: true,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getGuide(
  sb: Service,
  path: string,
): Promise<Buffer | null> {
  const { data, error } = await sb.storage.from(GUIDE_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
