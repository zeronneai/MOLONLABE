import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logDbError } from "@/lib/db/log";
import { isGuideComplete } from "./fields";

// Is there going to be a guide for this game?
//
// THIS FILE EXISTS TO BE SAFE TO IMPORT. It is deliberately separate from
// `build.ts`, and it must never import it, because `build.ts` imports
// `@react-pdf/renderer` at module scope and that import is not inert:
//
//   $ node -e "import('@react-pdf/renderer')"
//   import resolved
//   UNHANDLED REJECTION: MODULE_NOT_FOUND … pdfkit/js/standard-fonts/Helvetica.cjs
//   UNHANDLED REJECTION: MODULE_NOT_FOUND …
//   UNHANDLED REJECTION: MODULE_NOT_FOUND …
//   UNHANDLED REJECTION: MODULE_NOT_FOUND …
//
// react-pdf loads pdfkit's standard fonts eagerly when it is loaded, and
// on the deployment where those files had not been traced into the
// bundle, the failure arrived as four rejections attached to no promise
// anybody could await. Nothing downstream can catch that. The only
// defence is for the module not to be in the graph at all, which is why
// checkout asks this question rather than asking the renderer.
//
// It answers from the row and renders nothing.

type Service = SupabaseClient<Database>;

/**
 * The name of the piece a guide will be about, or null.
 *
 * Null means "do not promise one" — no game, no prize on the game, or
 * one of the three owner sections missing, which is possible on a game
 * created before those columns existed.
 *
 * It does NOT mean the PDF exists yet. Nothing here builds, checks
 * storage, or touches the renderer. A guide the buyer is promised is one
 * `/guide` will produce on demand the first time they follow the link.
 */
export async function guideSubject(
  sb: Service,
  gameId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from("games")
    .select("guide_why, guide_care, guide_pairs, item:items(name)")
    .eq("id", gameId)
    .maybeSingle();
  if (error) {
    logDbError("guideSubject", error);
    return null;
  }
  if (!data) return null;

  const itemName = (data.item as { name?: string } | null)?.name;
  if (!itemName) return null;
  return isGuideComplete(data) ? itemName : null;
}
