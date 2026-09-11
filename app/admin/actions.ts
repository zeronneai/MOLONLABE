"use server";

// Admin mutations. Every action runs on the owner's session client, so
// RLS enforces `authenticated` — there is no service-role use here.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSessionSupabase } from "@/lib/supabase/session";
import { slugify } from "@/lib/slug";
import { parseUsdToCents } from "@/lib/money";
import type { Database, Json } from "@/lib/database.types";
import {
  ARCHIVED_STATUS,
  CATEGORIES,
  DEFAULT_EXCLUSION_NOTE,
  ITEM_STATUSES,
  PRODUCT_BUCKET,
  type ActionState,
} from "@/lib/admin/constants";
import { countItemReferences } from "@/lib/db/itemRefs";
import { logDbError } from "@/lib/db/log";
import {
  WATCHED_ITEM_FIELDS,
  changedFields,
  displayName,
  logActivity,
} from "@/lib/admin/audit";
import { DIFFICULTY_RANGES } from "@/lib/game/settings";
import { newSeed, redactName, selectWinner } from "@/lib/draw/select";
import type { DrawRecord } from "@/lib/draw/presentation";

export type { ActionState };

async function requireClient(): Promise<SupabaseClient<Database> | null> {
  const session = await requireSession();
  return session?.sb ?? null;
}

/**
 * The client AND who is holding it. Authorship and the activity log both
 * need the user, and every write already had to fetch it to check the
 * session — so it is returned rather than thrown away.
 */
async function requireSession(): Promise<
  { sb: SupabaseClient<Database>; user: User } | null
> {
  const sb = await getSessionSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? { sb, user } : null;
}

function revalidatePublic(slug?: string) {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/featured");
  if (slug) revalidatePath(`/inventory/${slug}`);
}

export async function setItemStatus(id: string, status: string): Promise<void> {
  const session = await requireSession();
  if (!session || !ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number])) return;
  const { sb, user } = session;
  const { data: was } = await sb
    .from("items")
    .select("name, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ status, updated_by_name: displayName(user) })
    .eq("id", id);
  if (error) console.error("setItemStatus:", error.message);
  else if (was?.status !== status) {
    await logActivity(sb, user, {
      action: "status", entity: "item", entityId: id, entityLabel: was?.name ?? null,
      field: "status", before: was?.status ?? null, after: status,
    });
  }
  revalidatePublic();
  revalidatePath("/admin/inventory");
}

/**
 * Archive: the item leaves the public site but keeps its row, its history
 * and anything linked to it. Applied immediately with no confirmation —
 * the caller shows an "Archived. Undo" toast, and the previous status is
 * returned so Undo can put it back exactly as it was.
 */
export async function archiveItem(id: string): Promise<string | null> {
  const session = await requireSession();
  if (!session) return null;
  const { sb, user } = session;
  const { data: before } = await sb
    .from("items")
    .select("name, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ status: ARCHIVED_STATUS, updated_by_name: displayName(user) })
    .eq("id", id);
  if (error) {
    console.error("archiveItem:", error.message);
    return null;
  }
  await logActivity(sb, user, {
    action: "archive", entity: "item", entityId: id, entityLabel: before?.name ?? null,
    field: "status", before: before?.status ?? null, after: ARCHIVED_STATUS,
  });
  revalidatePublic();
  revalidatePath("/admin/inventory");
  return before?.status ?? "available";
}

/** Undo for archive, and the Restore action on the Archived filter. */
export async function restoreItem(id: string, status: string): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const { sb, user } = session;
  const next = ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number])
    ? status
    : "available";
  const { data: was } = await sb.from("items").select("name").eq("id", id).maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ status: next, updated_by_name: displayName(user) })
    .eq("id", id);
  if (error) console.error("restoreItem:", error.message);
  else {
    await logActivity(sb, user, {
      action: "restore", entity: "item", entityId: id, entityLabel: was?.name ?? null,
      field: "status", before: ARCHIVED_STATUS, after: next,
    });
  }
  revalidatePublic();
  revalidatePath("/admin/inventory");
}

/**
 * Permanent delete, for records created in error. Refuses while anything
 * references the item — the database would refuse too (both item_id
 * foreign keys are ON DELETE RESTRICT), but failing here lets us say why
 * and point at Archive instead. Storage objects go first, otherwise the
 * row is gone and the files are orphaned with no way left to find them.
 */
export async function deleteItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  const { sb, user } = session;
  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Missing item." };

  const { data: item } = await sb
    .from("items")
    .select("id, name, images")
    .eq("id", id)
    .maybeSingle();
  if (!item) return { status: "error", message: "That item no longer exists." };

  const refs = await countItemReferences(sb, id);
  if (refs.total > 0) {
    return {
      status: "error",
      message: `${refs.label} still reference this item. Archive it instead.`,
    };
  }

  // Uploaded images live in the bucket; legacy Cloudinary URLs are not ours
  // to remove and are skipped.
  const marker = `/storage/v1/object/public/${PRODUCT_BUCKET}/`;
  const paths = (Array.isArray(item.images) ? item.images : [])
    .filter((u): u is string => typeof u === "string")
    .map((url) => {
      const at = url.indexOf(marker);
      return at === -1 ? null : url.slice(at + marker.length);
    })
    .filter((p): p is string => p !== null);
  if (paths.length > 0) {
    const { error } = await sb.storage.from(PRODUCT_BUCKET).remove(paths);
    // An unremovable file is a cleanup problem, not a reason to keep a
    // record the owner has decided is a mistake.
    if (error) console.error("deleteItem storage:", error.message);
  }

  const { error } = await sb.from("items").delete().eq("id", id);
  if (error) {
    console.error("deleteItem:", error.message);
    return { status: "error", message: "Could not delete that item." };
  }
  // Logged after the fact but with the label captured before, so the line
  // still names the thing that no longer exists.
  await logActivity(sb, user, {
    action: "delete", entity: "item", entityId: id, entityLabel: item.name,
    before: { name: item.name } as Json, after: null,
  });
  revalidatePublic();
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?deleted=1");
}

export async function toggleItemFeatured(id: string, next: boolean): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const { sb, user } = session;
  const { data: was } = await sb.from("items").select("name").eq("id", id).maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ is_featured: next, updated_by_name: displayName(user) })
    .eq("id", id);
  if (error) console.error("toggleItemFeatured:", error.message);
  else {
    await logActivity(sb, user, {
      action: "featured", entity: "item", entityId: id, entityLabel: was?.name ?? null,
      field: "is_featured", before: !next, after: next,
    });
  }
  revalidatePublic();
  revalidatePath("/admin/inventory");
}

export async function moveItem(id: string, direction: "up" | "down"): Promise<void> {
  const sb = await requireClient();
  if (!sb) return;
  const { data: rows, error } = await sb
    .from("items")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error || !rows) return;
  const index = rows.findIndex((r) => r.id === id);
  const swap = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swap < 0 || swap >= rows.length) return;
  // Normalize to sequential order, then swap the two positions.
  const ordered = rows.map((r) => r.id);
  [ordered[index], ordered[swap]] = [ordered[swap], ordered[index]];
  await Promise.all(
    ordered.map((rowId, position) =>
      sb.from("items").update({ sort_order: position }).eq("id", rowId),
    ),
  );
  revalidatePublic();
  revalidatePath("/admin/inventory");
}

export async function duplicateItem(id: string): Promise<void> {
  const sb = await requireClient();
  if (!sb) return;
  const { data: item } = await sb.from("items").select("*").eq("id", id).maybeSingle();
  if (!item) return;
  // Sizes come across, their stock does not. A duplicate is a new run of
  // shirts; inheriting the original's counts would put stock on the shelf
  // that nobody has actually received.
  const { data: sourceVariants } = item.has_variants
    ? await sb
        .from("item_variants")
        .select("size, sort_order")
        .eq("item_id", id)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const suffix = Date.now().toString(36).slice(-4);
  const { data: copy, error } = await sb
    .from("items")
    .insert({
      slug: `${item.slug}-copy-${suffix}`,
      name: `${item.name} COPY`,
      category: item.category,
      brand: item.brand,
      short_desc: item.short_desc,
      long_desc: item.long_desc,
      specs: item.specs,
      price_display: item.price_display,
      price_cents: item.price_cents,
      fulfillment_type: item.fulfillment_type,
      has_variants: item.has_variants,
      // Duplicates start archived so a half-finished copy is never public.
      // That keeps them out of the working list, so we open the copy
      // directly — duplicating is only ever a prelude to editing.
      status: ARCHIVED_STATUS,
      is_featured: false,
      sort_order: (item.sort_order ?? 0) + 1,
      images: item.images,
      video_url: item.video_url,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("duplicateItem:", error.message);
    return;
  }
  if (copy?.id && (sourceVariants ?? []).length > 0) {
    const { error: variantError } = await sb.from("item_variants").insert(
      (sourceVariants ?? []).map((v) => ({
        item_id: copy.id,
        size: v.size,
        stock: 0,
        sort_order: v.sort_order,
      })),
    );
    if (variantError) logDbError("duplicateItem variants", variantError);
  }
  revalidatePath("/admin/inventory");
  if (copy?.id) redirect(`/admin/inventory/${copy.id}`);
}

export async function saveItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  const { sb, user } = session;
  const actor = displayName(user);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const status = String(formData.get("status") ?? "available");
  if (name.length < 2) return { status: "error", message: "Name is required." };
  if (!(CATEGORIES as readonly string[]).includes(category))
    return { status: "error", message: "Pick a category." };
  if (!ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number]))
    return { status: "error", message: "Bad status." };

  // Sizes. Parsed before anything is written, so a corrupted payload
  // fails the save rather than half-applying to a live item.
  const hasVariants = formData.get("has_variants") === "on";
  let variants: { id?: string; size: string; stock: number }[] = [];
  try {
    const parsed: unknown = JSON.parse(String(formData.get("variants") ?? "[]"));
    if (Array.isArray(parsed)) {
      variants = parsed.flatMap((v) => {
        if (!v || typeof v !== "object") return [];
        const { id, size, stock } = v as Record<string, unknown>;
        const label = typeof size === "string" ? size.trim() : "";
        if (!label) return [];
        const count = Math.max(0, Math.floor(Number(stock) || 0));
        return [{ id: typeof id === "string" ? id : undefined, size: label, stock: count }];
      });
    }
  } catch {
    return { status: "error", message: "Size list is corrupted — reload and retry." };
  }
  if (hasVariants) {
    const seen = new Set<string>();
    for (const v of variants) {
      const key = v.size.toLowerCase();
      // The database has a unique index on this; catching it here gives
      // the owner the actual size that clashed instead of a constraint code.
      if (seen.has(key)) {
        return { status: "error", message: `"${v.size}" is listed twice.` };
      }
      seen.add(key);
    }
  }

  let images: Json = [];
  try {
    const parsed: unknown = JSON.parse(String(formData.get("images") ?? "[]"));
    if (Array.isArray(parsed))
      images = parsed.filter((u): u is string => typeof u === "string");
  } catch {
    return { status: "error", message: "Image list is corrupted — reload and retry." };
  }

  const specKeys = formData.getAll("spec_key").map(String);
  const specVals = formData.getAll("spec_val").map(String);
  const specs: Record<string, string> = {};
  specKeys.forEach((key, i) => {
    const k = key.trim();
    const v = (specVals[i] ?? "").trim();
    if (k && v) specs[k] = v;
  });

  const row = {
    name,
    slug: slugify(String(formData.get("slug") ?? "").trim() || name),
    category,
    brand: String(formData.get("brand") ?? "").trim() || null,
    short_desc: String(formData.get("short_desc") ?? "").trim() || null,
    long_desc: String(formData.get("long_desc") ?? "").trim() || null,
    price_display: String(formData.get("price_display") ?? "").trim() || null,
    // Blank, or anything that is not a clean amount, becomes "not sold
    // online" rather than a guessed number. A typo here would charge a
    // real card the wrong figure.
    price_cents: parseUsdToCents(String(formData.get("price_online") ?? "")),
    fulfillment_type:
      String(formData.get("fulfillment_type") ?? "") === "ship" ? "ship" : "pickup",
    shipping_tier:
      String(formData.get("shipping_tier") ?? "") === "oversize" ? "oversize" : "standard",
    has_variants: hasVariants,
    video_url: String(formData.get("video_url") ?? "").trim() || null,
    status,
    is_featured: formData.get("is_featured") === "on",
    specs: specs as Json,
    images,
  };

  // Read the old row first: the activity log needs what the price and
  // status were, and after the write that is gone.
  const { data: previous } = id
    ? await sb.from("items").select("*").eq("id", id).maybeSingle()
    : { data: null };

  // Authorship is never read from the form. These are the only two fields
  // the browser cannot influence, and the database stamps the ids from the
  // session on top of this as a second lock.
  const stamped = id
    ? { ...row, updated_by_name: actor }
    : { ...row, created_by_name: actor, updated_by_name: actor };

  const { data: saved, error } = id
    ? await sb.from("items").update(stamped).eq("id", id).select("id").maybeSingle()
    : await sb.from("items").insert(stamped).select("id").maybeSingle();

  if (error || !saved) {
    console.error("saveItem:", error?.message);
    return {
      status: "error",
      message: error?.code === "23505" ? "That slug is taken." : "Save failed — try again.",
    };
  }

  // Sizes are only synced while the toggle is on. Turning it off leaves
  // the rows where they are rather than deleting them — the pricer
  // ignores them entirely, and an owner who unticks the box by accident
  // does not lose their stock counts.
  if (hasVariants) {
    const keep = variants.filter((v) => v.id).map((v) => v.id as string);
    let removal = sb.from("item_variants").delete().eq("item_id", saved.id);
    if (keep.length > 0) removal = removal.not("id", "in", `(${keep.join(",")})`);
    const { error: deleteError } = await removal;
    if (deleteError) logDbError("saveItem variants delete", deleteError);

    for (const [index, variant] of variants.entries()) {
      const payload = { size: variant.size, stock: variant.stock, sort_order: index };
      const { error: variantError } = variant.id
        ? await sb.from("item_variants").update(payload).eq("id", variant.id)
        : await sb
            .from("item_variants")
            .insert({ ...payload, item_id: saved.id });
      if (variantError) {
        console.error("saveItem variant:", variantError.message);
        return {
          status: "error",
          message:
            variantError.code === "23505"
              ? `"${variant.size}" is already listed.`
              : "The item saved but its sizes did not. Open it again and check.",
        };
      }
    }
  }
  if (!id) {
    await logActivity(sb, user, {
      action: "create", entity: "item", entityId: saved.id, entityLabel: row.name,
    });
  } else {
    const diffs = changedFields(
      previous as unknown as Record<string, unknown> | null,
      row as unknown as Record<string, unknown>,
      WATCHED_ITEM_FIELDS,
    );
    for (const diff of diffs) {
      await logActivity(sb, user, {
        action: diff.field === "price_cents" ? "price" : diff.field === "status" ? "status" : "update",
        entity: "item", entityId: saved.id, entityLabel: row.name,
        field: diff.field, before: diff.before, after: diff.after,
      });
    }
  }

  revalidatePublic(row.slug);
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory");
}

export async function setInquiryStatus(id: string, status: string): Promise<void> {
  const sb = await requireClient();
  if (!sb || !["new", "contacted", "closed"].includes(status)) return;
  const { error } = await sb.from("inquiries").update({ status }).eq("id", id);
  if (error) console.error("setInquiryStatus:", error.message);
  revalidatePath("/admin/inquiries");
}

// --- Game & Offer ----------------------------------------------------------

async function readSetting(
  sb: SupabaseClient<Database>,
  key: string,
): Promise<Record<string, unknown>> {
  const { data } = await sb.from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value && typeof data.value === "object" && !Array.isArray(data.value)
    ? (data.value as Record<string, unknown>)
    : {};
}

async function writeSetting(
  sb: SupabaseClient<Database>,
  key: string,
  value: Json,
  actor?: string,
): Promise<boolean> {
  const { error } = await sb
    .from("settings")
    .upsert(
      { key, value, ...(actor ? { updated_by_name: actor } : {}) },
      { onConflict: "key" },
    );
  if (error) console.error(`writeSetting ${key}:`, error.message);
  return !error;
}

function revalidateGame() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/game");
}

/** The kill switch: flips only `enabled`, touches nothing else. */
export async function toggleGameOffer(enabled: boolean): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const { sb, user } = session;
  const current = await readSetting(sb, "game_offer");
  const was = current.enabled === true;
  await writeSetting(sb, "game_offer", { ...current, enabled } as Json, displayName(user));
  if (was !== enabled) {
    // Turning a live discount on or off is the settings change most worth
    // being able to point at afterwards.
    await logActivity(sb, user, {
      action: "offer", entity: "settings", entityLabel: "Game & Offer",
      field: "enabled", before: was, after: enabled,
    });
  }
  revalidateGame();
}

export async function saveGameOffer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  const { sb, user } = session;
  const actor = displayName(user);

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!code) return { status: "error", message: "The code can't be empty." };
  const value = String(formData.get("value") ?? "").trim();
  if (!value) return { status: "error", message: "Describe the reward in plain language." };
  const expires = String(formData.get("expires") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || DEFAULT_EXCLUSION_NOTE;

  const current = await readSetting(sb, "game_offer");
  const ok = await writeSetting(sb, "game_offer", {
    enabled: current.enabled === true, // the form never flips the switch
    code,
    value,
    expires,
    note,
  } as Json, actor);
  if (!ok) return { status: "error", message: "Save failed — try again." };
  if (current.code !== code) {
    await logActivity(sb, user, {
      action: "offer", entity: "settings", entityLabel: "Game & Offer",
      field: "code", before: (current.code ?? null) as Json, after: code,
    });
  }
  revalidateGame();
  return { status: "idle", message: "Saved." };
}

export async function saveGameDifficulty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  const { sb, user } = session;
  const actor = displayName(user);

  const mode = String(formData.get("mode") ?? "");
  if (mode !== "desktop" && mode !== "mobile")
    return { status: "error", message: "Bad mode." };

  const clampField = (name: keyof typeof DIFFICULTY_RANGES) => {
    const raw = Number(formData.get(name));
    const range = DIFFICULTY_RANGES[name];
    if (!Number.isFinite(raw)) return null;
    return Math.min(range.max, Math.max(range.min, Math.round(raw)));
  };
  const roundSeconds = Number(formData.get("roundSeconds"));
  const roundMs = Number.isFinite(roundSeconds)
    ? Math.min(
        DIFFICULTY_RANGES.roundMs.max,
        Math.max(DIFFICULTY_RANGES.roundMs.min, Math.round(roundSeconds) * 1000),
      )
    : null;
  const targetCount = clampField("targetCount");
  const popMs = clampField("popMs");
  const magSize = clampField("magSize");
  if (roundMs === null || targetCount === null || popMs === null || magSize === null)
    return { status: "error", message: "Every field needs a number." };

  const current = await readSetting(sb, "game_difficulty");
  const ok = await writeSetting(sb, "game_difficulty", {
    ...current,
    [mode]: { roundMs, targetCount, popMs, magSize },
  } as Json, actor);
  if (!ok) return { status: "error", message: "Save failed — try again." };
  await logActivity(sb, user, {
    action: "difficulty", entity: "settings", entityLabel: `Game difficulty (${mode})`,
    field: mode, before: (current[mode] ?? null) as Json,
    after: { roundMs, targetCount, popMs, magSize } as Json,
  });
  revalidateGame();
  return { status: "idle", message: "Saved." };
}

/**
 * Tax and postage.
 *
 * The rate is entered as a percentage because that is how a human says it
 * and how an accountant states it; it is stored in basis points because
 * 8.25 is not representable in binary floating point and a tax figure is
 * the last place to accept a rounding error.
 */
export async function saveCommerce(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  const { sb, user } = session;
  const actor = displayName(user);

  const percent = Number(String(formData.get("tax_percent") ?? "").trim());
  if (!Number.isFinite(percent) || percent < 0 || percent > 25)
    return { status: "error", message: "Tax rate must be a percentage between 0 and 25." };
  const taxRateBps = Math.round(percent * 100);

  const standard = parseUsdToCents(String(formData.get("shipping_standard") ?? ""));
  const oversize = parseUsdToCents(String(formData.get("shipping_oversize") ?? ""));
  // Zero is a legitimate answer — free postage is a decision — so an empty
  // or malformed field is the failure, not a zero.
  const standardCents = String(formData.get("shipping_standard") ?? "").trim() === "0" ? 0 : standard;
  const oversizeCents = String(formData.get("shipping_oversize") ?? "").trim() === "0" ? 0 : oversize;
  if (standardCents === null || oversizeCents === null)
    return { status: "error", message: "Both postage amounts need a number." };

  const current = await readSetting(sb, "commerce");
  const ok = await writeSetting(sb, "commerce", {
    ...current,
    tax_rate_bps: taxRateBps,
    shipping_standard_cents: standardCents,
    shipping_oversize_cents: oversizeCents,
  } as Json, actor);
  if (!ok) return { status: "error", message: "Save failed — try again." };

  for (const [field, before, after] of [
    ["tax_rate_bps", current.tax_rate_bps, taxRateBps],
    ["shipping_standard_cents", current.shipping_standard_cents, standardCents],
    ["shipping_oversize_cents", current.shipping_oversize_cents, oversizeCents],
  ] as const) {
    if ((before ?? null) === after) continue;
    await logActivity(sb, user, {
      action: "commerce", entity: "settings", entityLabel: "Tax & Shipping",
      field, before: (before ?? null) as Json, after: after as Json,
    });
  }

  revalidatePublic();
  revalidatePath("/admin/commerce");
  return { status: "idle", message: "Saved." };
}

/**
 * Create or retitle a game.
 *
 * The two numbers that define it — how many spots and what each costs —
 * are set directly rather than derived from the item's price, because
 * only a person knows what a spot in *this* prize is worth.
 *
 * They are fixed at creation and cannot be edited afterwards. Changing
 * the count would orphan or invent spots that people have already bought
 * against; changing the price would mean two buyers paid differently for
 * the same thing. The form says so rather than silently ignoring an edit.
 */
export async function saveGame(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  const { sb, user } = session;
  const actor = displayName(user);

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { status: "error", message: "Title is required." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const winnerNote = String(formData.get("winner_note") ?? "").trim() || null;
  const itemId = String(formData.get("item_id") ?? "").trim() || null;

  // Editing: only the words. The numbers are settled.
  if (id) {
    const { error } = await sb
      .from("games")
      .update({
        title,
        description,
        winner_note: winnerNote,
        item_id: itemId,
        updated_by_name: actor,
      })
      .eq("id", id);
    if (error) {
      console.error("saveGame update:", error.message);
      return { status: "error", message: "Save failed — try again." };
    }
    await logActivity(sb, user, {
      action: "update", entity: "game", entityId: id, entityLabel: title,
    });
    revalidatePublic();
    revalidatePath("/admin/games");
    redirect("/admin/games");
  }

  const totalSpots = Math.round(Number(formData.get("total_spots") ?? 0) || 0);
  const spotPriceCents = parseUsdToCents(String(formData.get("spot_price") ?? ""));
  if (!Number.isFinite(totalSpots) || totalSpots < 1 || totalSpots > 10_000)
    return { status: "error", message: "Spots must be a whole number between 1 and 10,000." };
  if (spotPriceCents === null || spotPriceCents < 100)
    return { status: "error", message: "Price per spot must be at least $1.00." };

  const { data: game, error } = await sb
    .from("games")
    .insert({
      title,
      description,
      winner_note: winnerNote,
      item_id: itemId,
      total_spots: totalSpots,
      spot_price_cents: spotPriceCents,
      status: "open",
      created_by_name: actor,
      updated_by_name: actor,
    })
    .select("id")
    .single();

  if (error || !game) {
    console.error("saveGame insert:", error?.message);
    return { status: "error", message: "Save failed — try again." };
  }

  // Every spot exists from the moment the game does. See the migration
  // for why this is rows rather than a counter.
  const spots = Array.from({ length: totalSpots }, (_, i) => ({
    game_id: game.id,
    spot_number: i + 1,
  }));
  // Chunked: a 10,000-spot game is one statement too many for a single
  // insert, and a half-created board is worse than a slow one.
  for (let i = 0; i < spots.length; i += 500) {
    const { error: spotError } = await sb
      .from("game_spots")
      .insert(spots.slice(i, i + 500));
    if (spotError) {
      logDbError("saveGame spots", spotError);
      // The game exists but cannot be sold from. Remove it rather than
      // leave a board with holes in it.
      await sb.from("games").delete().eq("id", game.id);
      return {
        status: "error",
        message: "Could not lay out the spots — nothing was created. Try again.",
      };
    }
  }

  await logActivity(sb, user, {
    action: "create", entity: "game", entityId: game.id, entityLabel: title,
    after: { spots: totalSpots, price_cents: spotPriceCents } as Json,
  });
  revalidatePublic();
  revalidatePath("/admin/games");
  redirect("/admin/games");
}

// --- The draw --------------------------------------------------------------

/**
 * Commits the draw and returns the record of it.
 *
 * This is the only place a winner is decided. It runs to completion —
 * seed generated, winner selected, row written — before anything is
 * animated, so the presentation screen is showing a result that already
 * exists in the database rather than producing one. Nothing downstream
 * can change the outcome; the worst a broken animation can do is fail to
 * display a winner who is already recorded.
 *
 * The pool is one row per SOLD spot, each worth one ticket. Somebody
 * holding five spots appears five times and has five chances, which is
 * the whole model — and it means `selectWinner` needs no arithmetic about
 * weights at all. The winning ticket number IS the winning spot number,
 * which is a far better thing to read aloud than an abstract index.
 *
 * Idempotent by design: a game that already has a winner returns that
 * winner instead of drawing a second one. That is what lets the owner
 * re-run the presentation, or recover from a phone that locked mid-take,
 * without touching the result.
 */
export async function commitDraw(gameId: string): Promise<DrawRecord> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const { sb, user } = session;

  const { data: already } = await sb
    .from("winners")
    .select("display_name, ticket, entry_total, seed, drawn_at")
    .eq("game_id", gameId)
    .maybeSingle();
  if (already) {
    return {
      ok: true,
      replay: true,
      name: already.display_name,
      ticket: already.ticket ?? 0,
      total: already.entry_total ?? 0,
      seed: already.seed ?? "",
      drawnAt: already.drawn_at,
    };
  }

  // Sold only. A held spot is a checkout in progress and is not in the
  // draw — drawing one would hand the prize to somebody whose card may
  // still decline.
  const { data: spots, error } = await sb
    .from("game_spots")
    .select("id, spot_number, first_name, last_name")
    .eq("game_id", gameId)
    .eq("status", "sold")
    .order("spot_number");
  if (error) {
    console.error("commitDraw:", error.message);
    return { ok: false, error: "Could not read the spots." };
  }
  if (!spots || spots.length === 0) {
    return { ok: false, error: "No spots have sold, so there is nothing to draw." };
  }

  const seed = newSeed();
  // One ticket per spot. Ordered by spot number so the ticket the seed
  // picks is the spot number itself.
  const result = selectWinner(
    spots.map((sp) => ({ id: sp.id, weight: 1 })),
    seed,
  );
  if (!result) return { ok: false, error: "There is nothing to draw from." };

  const winner = spots.find((sp) => sp.id === result.entrantId);
  if (!winner) return { ok: false, error: "Could not resolve the winner." };

  // Redacted at write time: the surname never reaches the winners table,
  // so no future component can leak it by rendering the wrong column.
  const displayNameOfWinner = redactName(
    winner.first_name ?? "",
    winner.last_name ?? "",
  );

  const { data: written, error: insertError } = await sb
    .from("winners")
    .insert({
      game_id: gameId,
      spot_id: winner.id,
      display_name: displayNameOfWinner,
      seed: result.seed,
      ticket: result.ticket,
      entry_total: result.total,
    })
    .select("drawn_at")
    .maybeSingle();
  if (insertError) {
    console.error("commitDraw insert:", insertError.message);
    return { ok: false, error: "Could not record the winner." };
  }

  await sb
    .from("games")
    .update({ status: "drawn", updated_by_name: displayName(user) })
    .eq("id", gameId);
  // The draw is the single least reversible thing anyone does in here.
  await logActivity(sb, user, {
    action: "draw", entity: "game", entityId: gameId,
    entityLabel: null,
    field: "winner", before: null,
    after: { name: displayNameOfWinner, ticket: result.ticket, total: result.total, seed: result.seed } as Json,
  });
  revalidatePublic();
  revalidatePath("/admin/games");

  return {
    ok: true,
    replay: false,
    name: displayNameOfWinner,
    ticket: result.ticket,
    total: result.total,
    seed: result.seed,
    drawnAt: written?.drawn_at ?? new Date().toISOString(),
  };
}

/** The plain admin-panel draw. Same algorithm, no theater. */
export async function drawWinner(campaignId: string): Promise<void> {
  const record = await commitDraw(campaignId);
  if (!record.ok) console.error("drawWinner:", record.error);
}
