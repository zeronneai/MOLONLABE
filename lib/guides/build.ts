import "server-only";

import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GameRow, ItemRow } from "@/lib/database.types";
import { itemImages, itemSpecs } from "@/lib/db/items";
import { logDbError } from "@/lib/db/log";
import { GuideDocument, type GuideData } from "./Document";
import { guideFieldErrors } from "./fields";
import { fetchGuideImages } from "./images";
import { getGuide, guideObjectPath, putGuide } from "./storage";

// Building the guide, and deciding when it needs building.
//
// LAZY, AND REBUILT WHEN ITS INPUTS MOVE
//
// A guide is produced the first time somebody buys into its game, not
// when the game is created: most of the work is fetching photographs and
// laying out a document, and a game nobody buys into should not cost any
// of it. After that it is served as it is until something it is made of
// changes.
//
// "Changes" is a fact, not a habit. `fingerprint` hashes every single
// thing that appears on the page — the owner's three sections, the item's
// name, brand, copy, specifications and photograph URLs, and the version
// of the document below. If any of them moves the hash moves, and the
// next read rebuilds. Nothing has to remember to invalidate anything,
// which is the only version of this that stays true.
//
// FAILURE IS NOT THE ORDER'S PROBLEM
//
// Every function here reports failure rather than throwing. A guide that
// cannot be built must never take down a checkout that has already
// charged a card, and the buyer's link self-heals on the next request —
// see app/guide/[order]/route.ts, which builds on demand.

/**
 * Bump this when the document changes shape.
 *
 * It is part of the fingerprint, so bumping it rebuilds every guide on
 * next read. Without it, a redesign would apply only to games created
 * afterwards and the shop would be handing out two different documents.
 */
export const GUIDE_VERSION = "1";

export type GameWithItem = GameRow & { item: ItemRow | null };

export type GuideOutcome =
  | {
      ok: true;
      path: string;
      rebuilt: boolean;
      /** The piece the guide is about. The email names it. */
      itemName: string;
    }
  | { ok: false; reason: "no-item" | "incomplete" | "render" | "storage"; message: string };

type Service = SupabaseClient<Database>;

/** Everything the PDF is made of, in one object, so it can be hashed. */
function guideData(game: GameWithItem): GuideData | null {
  const item = game.item;
  if (!item) return null;
  return {
    gameTitle: game.title,
    item: {
      name: item.name,
      brand: item.brand,
      category: item.category,
      shortDesc: item.short_desc,
      longDesc: item.long_desc,
      specs: itemSpecs(item),
    },
    why: (game.guide_why ?? "").trim(),
    care: (game.guide_care ?? "").trim(),
    pairs: (game.guide_pairs ?? "").trim(),
    images: [],
  };
}

/**
 * The hash that decides whether a stored guide is still the right one.
 *
 * Image URLs rather than image bytes: hashing the bytes would mean
 * downloading four photographs to answer "does this need rebuilding?",
 * on every request, which defeats the point. A photograph replaced at the
 * same URL is the one change this will not notice, and Cloudinary and the
 * product-images bucket both mint a new URL per upload.
 */
export function fingerprint(game: GameWithItem): string {
  const data = guideData(game);
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify({
      version: GUIDE_VERSION,
      data,
      images: game.item ? itemImages(game.item) : [],
    }),
  );
  return hash.digest("hex").slice(0, 32);
}

async function loadGame(sb: Service, gameId: string): Promise<GameWithItem | null> {
  const { data, error } = await sb
    .from("games")
    .select("*, item:items(*)")
    .eq("id", gameId)
    .maybeSingle();
  if (error) {
    logDbError("guide loadGame", error);
    return null;
  }
  return (data as GameWithItem) ?? null;
}

/**
 * Renders the PDF. Returns null rather than throwing.
 *
 * The photographs are fetched first and handed over as bytes — see
 * lib/guides/images.ts for why the renderer is not allowed to fetch them
 * itself.
 */
export async function renderGuide(game: GameWithItem): Promise<Buffer | null> {
  const base = guideData(game);
  if (!base) return null;
  try {
    const images = await fetchGuideImages(
      game.item ? itemImages(game.item) : [],
    );
    return await renderToBuffer(GuideDocument({ ...base, images }));
  } catch (error) {
    console.error(`guide render failed for game ${game.id}:`, error);
    return null;
  }
}

/**
 * Makes sure the stored guide matches the game as it stands.
 *
 * Cheap when nothing has changed: one row read and a string comparison.
 * Called from checkout so the first buyer's link is already warm, and
 * again from the route that serves it so a build that failed at checkout
 * is not permanent.
 */
export async function refreshGuide(
  sb: Service,
  gameId: string,
): Promise<GuideOutcome> {
  const game = await loadGame(sb, gameId);
  if (!game) {
    return { ok: false, reason: "no-item", message: "No such game." };
  }
  if (!game.item) {
    return {
      ok: false,
      reason: "no-item",
      message: "That game has no prize attached, so there is nothing to write about.",
    };
  }
  const missing = guideFieldErrors(game);
  if (Object.keys(missing).length > 0) {
    return {
      ok: false,
      reason: "incomplete",
      message: Object.values(missing)[0] ?? "The guide fields are not filled in.",
    };
  }

  const want = fingerprint(game);
  const path = guideObjectPath(gameId);
  if (game.guide_path === path && game.guide_fingerprint === want) {
    return { ok: true, path, rebuilt: false, itemName: game.item.name };
  }

  const bytes = await renderGuide(game);
  if (!bytes) {
    return { ok: false, reason: "render", message: "The guide could not be rendered." };
  }
  const stored = await putGuide(sb, path, bytes);
  if (!stored.ok) {
    console.error(`guide upload failed for game ${gameId}: ${stored.message}`);
    return { ok: false, reason: "storage", message: stored.message };
  }

  // Recorded only after the bytes are safely in the bucket. The other
  // order would leave a row claiming a guide that is not there, which
  // reads as "current" for ever and never rebuilds.
  const { error } = await sb
    .from("games")
    .update({
      guide_path: path,
      guide_fingerprint: want,
      guide_generated_at: new Date().toISOString(),
    })
    .eq("id", gameId);
  if (error) logDbError("guide record", error);

  return { ok: true, path, rebuilt: true, itemName: game.item.name };
}

/** The bytes, built first if they need building. */
export async function readGuide(
  sb: Service,
  gameId: string,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; message: string }> {
  const outcome = await refreshGuide(sb, gameId);
  if (!outcome.ok) return { ok: false, message: outcome.message };
  const bytes = await getGuide(sb, outcome.path);
  if (!bytes) {
    return { ok: false, message: "The guide is recorded but could not be read back." };
  }
  return { ok: true, bytes };
}
