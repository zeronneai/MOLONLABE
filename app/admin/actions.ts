"use server";

// Admin mutations. Every action runs on the signed-in person's session
// client, so row level security applies to every write — there is no
// service-role use here.
//
// Two roles. The owner can do everything; the manager cannot delete
// anything permanently, change tax, shipping, the offer or the arcade,
// or touch the demo game. The DATABASE refuses those for a manager
// whatever arrives here (supabase/migrations/20260928100000_staff_roles.sql,
// tests/db/roles.mjs). The checks in this file are the second lock, and
// the reason a manager reads "owner only" instead of a save that quietly
// changed nothing, which is how row level security refuses an update.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionSupabase } from "@/lib/supabase/session";
import {
  ROLES_MIGRATION,
  refuseManager,
  requireStaff,
  type Staff,
} from "@/lib/admin/staff";
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
  logActivity,
} from "@/lib/admin/audit";
import { DIFFICULTY_RANGES } from "@/lib/game/settings";
import { DEMO_GAME_PREFIX, isFirearmCategory } from "@/lib/surfaces";
import { firstGuideError } from "@/lib/guides/fields";
import { newSeed, redactName, selectWinner, verifyDraw } from "@/lib/draw/select";
import type { DrawRecord } from "@/lib/draw/presentation";
import {
  ALERT_ROUTING_KEY,
  EMPTY_ROUTING,
  MAX_RECIPIENTS,
  parseRecipients,
  readRouting,
} from "@/lib/alerts";
import { sendAlert } from "@/lib/notify";

export type { ActionState };

/** Any member of staff. Owner-only actions check `role` after this. */
async function requireSession(): Promise<Staff | null> {
  return requireStaff();
}

/** The item fields logged by name only; see saveItem. */
const ITEM_DETAIL_FIELDS = [
  "name", "slug", "category", "brand", "short_desc", "long_desc",
  "price_display", "has_variants", "video_url", "specs",
] as const;
const ITEM_FIELD_NAMES: Record<string, string> = {
  name: "name", slug: "web address", category: "category", brand: "brand",
  short_desc: "short description", long_desc: "description",
  price_display: "price label", has_variants: "sizes on/off",
  video_url: "video", specs: "specifications",
};

function revalidatePublic(slug?: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/games");
  revalidatePath("/in-the-case");
  revalidatePath("/featured");
  // The product page lives at one path whichever surface links to it.
  if (slug) revalidatePath(`/inventory/${slug}`);
}

export async function setItemStatus(id: string, status: string): Promise<void> {
  const session = await requireSession();
  if (!session || !ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number])) return;
  const { sb } = session;
  const { data: was } = await sb
    .from("items")
    .select("name, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ status, updated_by_name: session.name })
    .eq("id", id);
  if (error) console.error("setItemStatus:", error.message);
  else if (was?.status !== status) {
    await logActivity(sb, session, {
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
  const { sb } = session;
  const { data: before } = await sb
    .from("items")
    .select("name, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ status: ARCHIVED_STATUS, updated_by_name: session.name })
    .eq("id", id);
  if (error) {
    console.error("archiveItem:", error.message);
    return null;
  }
  await logActivity(sb, session, {
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
  const { sb } = session;
  const next = ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number])
    ? status
    : "available";
  const { data: was } = await sb.from("items").select("name").eq("id", id).maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ status: next, updated_by_name: session.name })
    .eq("id", id);
  if (error) console.error("restoreItem:", error.message);
  else {
    await logActivity(sb, session, {
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
  // Permanent. A manager archives instead, which keeps everything.
  if (session.role !== "owner") return refuseManager(session, "delete an item");
  const { sb } = session;
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
  await logActivity(sb, session, {
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
  const { sb } = session;
  const { data: was } = await sb.from("items").select("name").eq("id", id).maybeSingle();
  const { error } = await sb
    .from("items")
    .update({ is_featured: next, updated_by_name: session.name })
    .eq("id", id);
  if (error) console.error("toggleItemFeatured:", error.message);
  else {
    await logActivity(sb, session, {
      action: "featured", entity: "item", entityId: id, entityLabel: was?.name ?? null,
      field: "is_featured", before: !next, after: next,
    });
  }
  revalidatePublic();
  revalidatePath("/admin/inventory");
}

export async function moveItem(id: string, direction: "up" | "down"): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const { sb } = session;
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
  const { data: moved } = await sb.from("items").select("name").eq("id", id).maybeSingle();
  await logActivity(sb, session, {
    action: "update", entity: "item", entityId: id, entityLabel: moved?.name ?? null,
    field: "order", after: direction === "up" ? "moved up" : "moved down",
  });
  revalidatePublic();
  revalidatePath("/admin/inventory");
}

export async function duplicateItem(id: string): Promise<void> {
  const session = await requireSession();
  if (!session) return;
  const { sb } = session;
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
  if (copy?.id) {
    await logActivity(sb, session, {
      action: "create", entity: "item", entityId: copy.id, entityLabel: `${item.name} COPY`,
      field: "duplicated from", after: item.name,
    });
  }
  revalidatePath("/admin/inventory");
  if (copy?.id) redirect(`/admin/inventory/${copy.id}`);
}

/**
 * The first free slug at or after `base`: base, base-2, base-3…
 *
 * Checks against EVERY item including archived ones, because the unique
 * constraint does — suggesting a slug that is itself taken by something
 * invisible would be the same dead end one step further along.
 */
async function freeSlug(
  sb: NonNullable<Awaited<ReturnType<typeof getSessionSupabase>>>,
  base: string,
): Promise<string> {
  const { data } = await sb
    .from("items")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function saveItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  const { sb } = session;
  const actor = session.name;

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
    //
    // Forced null for a firearm. The form does not render the field for
    // those categories and the database rejects the row anyway, but a
    // form field is only absent until somebody posts the form by hand,
    // and this is the one place where the consequence is a firearm with
    // a Buy button.
    price_cents: isFirearmCategory(category)
      ? null
      : parseUsdToCents(String(formData.get("price_online") ?? "")),
    fulfillment_type:
      String(formData.get("fulfillment_type") ?? "") === "ship" ? "ship" : "pickup",
    shipping_tier:
      String(formData.get("shipping_tier") ?? "") === "oversize" ? "oversize" : "standard",
    // Null and zero mean different things: null falls back to the tier,
    // zero is free postage the owner chose. parseUsdToCents returns null
    // for a blank string and 0 for "0", which is exactly the distinction
    // wanted, so it is passed straight through.
    shipping_override_cents: parseUsdToCents(
      String(formData.get("shipping_override") ?? ""),
    ),
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
  const { data: previousVariants } = id
    ? await sb.from("item_variants").select("size, stock").eq("item_id", id)
    : { data: [] };

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
    // "That slug is taken." with nothing else is a dead end: the owner
    // cannot see WHICH item holds it, and the likeliest holder is an
    // archived one he cannot see in the list either. So the row is
    // looked up and named, its status is given, and a free alternative
    // is offered so there is a way forward rather than a wall.
    if (error?.code === "23505") {
      const { data: holder } = await sb
        .from("items")
        .select("name, slug, status")
        .eq("slug", row.slug)
        .maybeSingle();
      const suggestion = await freeSlug(sb, row.slug);
      if (!holder) {
        return {
          status: "error",
          message: `The web address "${row.slug}" is already used by another item. Try "${suggestion}".`,
        };
      }
      const archived = holder.status === ARCHIVED_STATUS;
      return {
        status: "error",
        message:
          `The web address "${row.slug}" belongs to "${holder.name}"` +
          (archived
            ? ", which is archived. Archived items keep their address so old links do not break and so a restore cannot collide. "
            : ` (${holder.status}). `) +
          `Use "${suggestion}" instead, or change that item's address first.`,
      };
    }
    return { status: "error", message: "Save failed — try again." };
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
    await logActivity(sb, session, {
      action: "create", entity: "item", entityId: saved.id, entityLabel: row.name,
    });
  } else {
    const diffs = changedFields(
      previous as unknown as Record<string, unknown> | null,
      row as unknown as Record<string, unknown>,
      WATCHED_ITEM_FIELDS,
    );
    for (const diff of diffs) {
      await logActivity(sb, session, {
        action: diff.field === "price_cents" ? "price" : diff.field === "status" ? "status" : "update",
        entity: "item", entityId: saved.id, entityLabel: row.name,
        field: diff.field, before: diff.before, after: diff.after,
      });
    }

    // Everything else, so that no edit goes unrecorded. The watched
    // fields above get a line each with before and after; the rest are
    // named in one line, because "changed the description" is what the
    // owner needs to know and the old paragraph is not.
    const was = (previous ?? {}) as Record<string, unknown>;
    const now = row as unknown as Record<string, unknown>;
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const other = ITEM_DETAIL_FIELDS.filter((f) => !same(was[f], now[f]));
    if (other.length > 0) {
      await logActivity(sb, session, {
        action: "update", entity: "item", entityId: saved.id, entityLabel: row.name,
        field: "details", after: other.map((f) => ITEM_FIELD_NAMES[f] ?? f).join(", "),
      });
    }

    const photosBefore = Array.isArray(was.images) ? was.images.length : 0;
    const photosAfter = Array.isArray(images) ? images.length : 0;
    if (!same(was.images, images)) {
      await logActivity(sb, session, {
        action: "photos", entity: "item", entityId: saved.id, entityLabel: row.name,
        field: "images", before: photosBefore, after: photosAfter,
      });
    }
  }

  // Sizes and stock, as a map of size to count before and after. A size
  // missing from "after" was removed, which is the one permanent delete
  // a manager can make, so it has to be on the record.
  if (hasVariants) {
    const before = Object.fromEntries(
      (previousVariants ?? []).map((v) => [v.size, v.stock]),
    );
    const after = Object.fromEntries(variants.map((v) => [v.size, v.stock]));
    if (JSON.stringify(before) !== JSON.stringify(after) && (id || variants.length > 0)) {
      await logActivity(sb, session, {
        action: "stock", entity: "item", entityId: saved.id, entityLabel: row.name,
        field: "sizes", before: before as Json, after: after as Json,
      });
    }
  }

  revalidatePublic(row.slug);
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory");
}

export async function setInquiryStatus(id: string, status: string): Promise<void> {
  const session = await requireSession();
  if (!session || !["new", "contacted", "closed"].includes(status)) return;
  const { sb } = session;
  const { data: was } = await sb
    .from("inquiries")
    .select("name, type, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb.from("inquiries").update({ status }).eq("id", id);
  if (error) console.error("setInquiryStatus:", error.message);
  else if (was && was.status !== status) {
    await logActivity(sb, session, {
      action: "status", entity: "inquiry", entityId: id,
      entityLabel: `${was.name} (${was.type})`,
      field: "status", before: was.status, after: status,
    });
  }
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
export async function toggleGameOffer(enabled: boolean): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  if (session.role !== "owner") return refuseManager(session, "switch the offer");
  const { sb } = session;
  const current = await readSetting(sb, "game_offer");
  const was = current.enabled === true;
  const ok = await writeSetting(sb, "game_offer", { ...current, enabled } as Json, session.name);
  if (!ok) return { status: "error", message: "The switch did not save. Try again." };
  if (was !== enabled) {
    // Turning a live discount on or off is the settings change most worth
    // being able to point at afterwards.
    await logActivity(sb, session, {
      action: "offer", entity: "settings", entityLabel: "Game & Offer",
      field: "enabled", before: was, after: enabled,
    });
  }
  revalidateGame();
  return { status: "idle", message: enabled ? "The offer is on." : "The offer is off." };
}

export async function saveGameOffer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  if (session.role !== "owner") return refuseManager(session, "change the offer code");
  const { sb } = session;
  const actor = session.name;

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
    await logActivity(sb, session, {
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
  if (session.role !== "owner") return refuseManager(session, "change the arcade difficulty");
  const { sb } = session;
  const actor = session.name;

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
  await logActivity(sb, session, {
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
  if (session.role !== "owner") return refuseManager(session, "change tax or shipping");
  const { sb } = session;
  const actor = session.name;

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
    await logActivity(sb, session, {
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
  const { sb } = session;
  const actor = session.name;

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { status: "error", message: "Title is required." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const winnerNote = String(formData.get("winner_note") ?? "").trim() || null;
  const itemId = String(formData.get("item_id") ?? "").trim() || null;

  // The guide is the thing being sold, so a game without one is refused.
  //
  // This is the enforcement the whole approved structure rests on: the
  // customer is buying a written guide to the piece, and entry into the
  // drawing comes with it. Everything else in that document is assembled
  // from the item — name, brand, specifications, description, photographs
  // — so a game whose three owner sections are blank is selling the
  // product page with a border round it.
  //
  // It refuses on EDIT as well as on create. Creating a game opens it for
  // sale in the same breath, so creation is publication and there is no
  // draft state to hold it in; and a game that could be emptied out after
  // the fact would make the rule decorative.
  const guide = {
    guide_why: String(formData.get("guide_why") ?? "").trim(),
    guide_care: String(formData.get("guide_care") ?? "").trim(),
    guide_pairs: String(formData.get("guide_pairs") ?? "").trim(),
  };
  const guideProblem = firstGuideError(guide);
  if (guideProblem) return { status: "error", message: guideProblem };

  // Editing: only the words. The numbers are settled.
  if (id) {
    const { error } = await sb
      .from("games")
      .update({
        title,
        description,
        winner_note: winnerNote,
        item_id: itemId,
        ...guide,
        updated_by_name: actor,
      })
      .eq("id", id);
    if (error) {
      console.error("saveGame update:", error.message);
      return { status: "error", message: "Save failed — try again." };
    }
    await logActivity(sb, session, {
      action: "update", entity: "game", entityId: id, entityLabel: title,
    });
    revalidatePublic();
    revalidatePath("/admin/games");
    redirect("/admin/games");
  }

  const totalSpots = Math.round(Number(formData.get("total_spots") ?? 0) || 0);
  const spotPriceCents = parseUsdToCents(String(formData.get("spot_price") ?? ""));
  if (!Number.isFinite(totalSpots) || totalSpots < 1 || totalSpots > 10_000)
    return { status: "error", message: "The number of guides must be a whole number between 1 and 10,000." };
  if (spotPriceCents === null || spotPriceCents < 100)
    return { status: "error", message: "The price per guide must be at least $1.00." };

  // The game and every one of its spots in a single transaction, by the
  // database. This used to be two steps with a delete of the game as the
  // clean-up if the spots failed half way; a manager may not delete a
  // game, so for him that clean-up would have been refused and left a
  // board on sale with holes in it. Now there is nothing to clean up.
  const { data: gameId, error } = await sb.rpc("create_game", {
    p_title: title,
    p_description: description,
    p_winner_note: winnerNote,
    p_item_id: itemId,
    p_guide_why: guide.guide_why,
    p_guide_care: guide.guide_care,
    p_guide_pairs: guide.guide_pairs,
    p_total_spots: totalSpots,
    p_spot_price_cents: spotPriceCents,
  });
  if (error || !gameId) {
    if (error) logDbError("saveGame create_game", error);
    return {
      status: "error",
      message:
        error?.code === "PGRST202"
          ? `The database is missing the create_game function. Apply ${ROLES_MIGRATION} in Supabase, then try again.`
          : "Could not create the drop. Nothing was created. Try again.",
    };
  }
  const game = { id: gameId };

  await logActivity(sb, session, {
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
 * weights at all.
 *
 * Two different numbers come out of this and they must not be confused.
 * `selectWinner` sorts the pool by spot id and returns an index into that
 * sorted list. The number announced and stored as `ticket` is the WINNING
 * SPOT NUMBER, which is a far better thing to read aloud than an abstract
 * index — and which is only the same number by coincidence. The index is
 * kept as `ticket_index` because reproducing the draw needs it.
 *
 * Everything needed to re-run the draw is written to the winners row: the
 * seed, the frozen pool, the index and the spot. `verifyDraw` re-runs it
 * from that row alone, and is called here before the row is stored.
 *
 * Idempotent by design: a game that already has a winner returns that
 * winner instead of drawing a second one. That is what lets the owner
 * re-run the presentation, or recover from a phone that locked mid-take,
 * without touching the result.
 */
/**
 * `acknowledgedEarly` is the owner having read the shortfall and said to
 * go anyway. It is not a convenience flag: the terms buyers accepted say
 * the game runs until the last spot sells, so drawing at 12 of 100 goes
 * against what they agreed to. The count is named back to him before he
 * confirms, and recorded on the winner afterwards.
 */
export async function commitDraw(
  gameId: string,
  acknowledgedEarly = false,
): Promise<DrawRecord> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const { sb } = session;

  const { data: already, error: alreadyError } = await sb
    .from("winners")
    .select("display_name, ticket, entry_total, seed, drawn_at")
    .eq("game_id", gameId)
    .maybeSingle();
  // This read is the only thing standing between a re-run and a second
  // draw. If it fails we do not know whether this game already has a
  // winner, and carrying on would risk overwriting one — so stop. This
  // used to be ignored, which is how a winners table missing its audit
  // columns turned into "couldn't save the winner" instead of naming the
  // real problem.
  if (alreadyError) {
    console.error("commitDraw existing-winner check:", alreadyError.message);
    return {
      ok: false,
      error:
        "Couldn't check whether this drop has already been drawn, so " +
        "nothing has been drawn. This usually means the database is " +
        "missing a column the draw needs. Nothing has changed — call " +
        "Purple Roots rather than trying again.",
    };
  }
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
    return {
      ok: false,
      error:
        "Couldn't read the guides sold for this drop. Nothing has been drawn. " +
        "Reload and try again; if it keeps happening, call Purple Roots.",
    };
  }

  if (!spots || spots.length === 0) {
    // Say which of the two reasons it is. "Nothing to draw" when the
    // board looks full is maddening, and the usual cause is spots stuck
    // mid-checkout rather than genuinely unsold.
    const { count: heldCount } = await sb
      .from("game_spots")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("status", "held");
    if ((heldCount ?? 0) > 0) {
      return {
        ok: false,
        error:
          `No guides are recorded as sold yet, but ${heldCount} ${heldCount === 1 ? "is" : "are"} ` +
          "still held from a checkout that didn't finish. Those release " +
          "themselves after 15 minutes. Wait, refresh, and draw then.",
      };
    }
    return {
      ok: false,
      error:
        "No guides have sold, so there is nobody to draw from. A drop has " +
        "to sell at least one guide before it can be drawn.",
    };
  }

  // How short the game is. Read from the game rather than counting rows,
  // because total_spots is fixed at creation and cannot drift.
  const { data: gameRow } = await sb
    .from("games")
    .select("total_spots, title")
    .eq("id", gameId)
    .maybeSingle();
  const totalSpots = gameRow?.total_spots ?? spots.length;
  const unsold = Math.max(0, totalSpots - spots.length);

  if (unsold > 0 && !acknowledgedEarly) {
    return {
      ok: false,
      needsEarlyConfirmation: true,
      unsold,
      totalSpots,
      error:
        `This drop has ${unsold} of ${totalSpots} guides unsold. Drawing now ` +
        "goes against the terms buyers agreed to. Continue?",
    };
  }

  const seed = newSeed();
  // One ticket per spot, so somebody holding five spots appears five
  // times and has five chances — which is why selectWinner needs no
  // arithmetic about weights at all.
  //
  // The selector sorts by spot id before walking, so the index it returns
  // is an index into an id-sorted list and is NOT the spot number. They
  // are mapped explicitly below. An earlier comment here claimed they
  // were the same number; they are not, and the admin page was showing
  // the index labelled as a spot.
  const result = selectWinner(
    spots.map((sp) => ({ id: sp.id, weight: 1 })),
    seed,
  );
  if (!result) return { ok: false, error: "There is nothing to draw from." };

  // The pool, frozen in the order the selector walked it. Recorded on the
  // winners row so a draw can be re-run from that row alone, without
  // trusting that game_spots has not changed since.
  const pool = [...spots]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((sp) => ({ spot_id: sp.id, spot_number: sp.spot_number }));

  const winner = spots.find((sp) => sp.id === result.entrantId);
  if (!winner)
    return {
      ok: false,
      error:
        "Picked a guide number that then couldn't be matched to a buyer. Nothing " +
        "has been drawn and nothing has changed. Call Purple Roots.",
    };

  // Redacted at write time: the surname never reaches the winners table,
  // so no future component can leak it by rendering the wrong column.
  const displayNameOfWinner = redactName(
    winner.first_name ?? "",
    winner.last_name ?? "",
  );

  // Everything needed to reproduce this draw, written in one row. The
  // audit trail is checked before it is stored rather than after: if the
  // recorded numbers do not re-run to this winner, the record would be
  // evidence of nothing and it is better to refuse than to file it.
  const audit = {
    seed: result.seed,
    pool,
    ticketIndex: result.ticket,
    ticket: winner.spot_number,
    total: result.total,
  };
  const proof = verifyDraw(audit);
  if (!proof.ok) {
    console.error("commitDraw self-check:", proof.reason);
    return {
      ok: false,
      error:
        "The draw ran but could not be verified, so nothing has been " +
        "saved and the drop is untouched. Do not draw on camera until " +
        "this is looked at — call Purple Roots.",
    };
  }

  const { data: written, error: insertError } = await sb
    .from("winners")
    .insert({
      game_id: gameId,
      spot_id: winner.id,
      display_name: displayNameOfWinner,
      seed: result.seed,
      // The spot number, not the selector's index — this is the number
      // that gets read aloud and printed under the winner.
      ticket: winner.spot_number,
      ticket_index: result.ticket,
      pool,
      entry_total: result.total,
      drawn_early: unsold > 0,
      unsold_spots: unsold,
    })
    .select("drawn_at")
    .maybeSingle();
  if (insertError) {
    console.error("commitDraw insert:", insertError.message);
    return {
      ok: false,
      error:
        "Couldn't save the winner, so nothing has been drawn. The drop " +
        "is untouched and safe to try again. If it fails twice, stop and " +
        "call Purple Roots rather than drawing on camera.",
    };
  }

  const { error: statusError } = await sb
    .from("games")
    .update({ status: "drawn", updated_by_name: session.name })
    .eq("id", gameId);
  if (statusError) {
    // The winner IS recorded — this is cosmetic, and saying "it failed"
    // would invite a second draw that the idempotency check would then
    // refuse confusingly. Log it and carry on.
    logDbError("commitDraw status", statusError);
  }
  // The draw is the single least reversible thing anyone does in here.
  await logActivity(sb, session, {
    action: "draw", entity: "game", entityId: gameId,
    entityLabel: gameRow?.title ?? null,
    field: "winner", before: null,
    after: {
      name: displayNameOfWinner,
      spot: winner.spot_number,
      ticketIndex: result.ticket,
      total: result.total,
      seed: result.seed,
      ...(unsold > 0 ? { drawnEarly: true, unsoldSpots: unsold } : {}),
    } as Json,
  });
  revalidatePublic();
  revalidatePath("/admin/games");
  // The detail page is where the draw happens, and a dynamic child is
  // not covered by revalidating its parent. Without this the winner is
  // written and the screen still says nobody has been drawn — which
  // reads exactly like a failure.
  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath(`/draw/${gameId}`);

  return {
    ok: true,
    replay: false,
    name: displayNameOfWinner,
    // The spot number, matching what is stored and what is announced.
    ticket: winner.spot_number,
    total: result.total,
    seed: result.seed,
    drawnAt: written?.drawn_at ?? new Date().toISOString(),
  };
}

/** The plain admin-panel draw. Same algorithm, no theater. */
/**
 * The plain button, for a draw nobody is filming.
 *
 * Returns the record rather than void. It used to swallow the reason into
 * the server log, which meant a refusal reached the owner as a dialog
 * quietly closing and nothing happening — on the one day he is about to
 * go live, that is the worst possible failure mode.
 */
export async function drawWinner(
  gameId: string,
  acknowledgedEarly = false,
): Promise<DrawRecord> {
  const record = await commitDraw(gameId, acknowledgedEarly);
  if (!record.ok) console.error("drawWinner:", record.error);
  return record;
}

// ---------------------------------------------------------------------
// The demo game
// ---------------------------------------------------------------------

/**
 * Creates one completed game so the client can see a populated Past
 * games section before a real one exists.
 *
 * Deliberately conspicuous. It is titled `[DEMO] …`, every spot is sold
 * to "Demo Buyer", and the public cards carry a DEMO badge — because the
 * failure this has to avoid is not "the demo looks unconvincing", it is
 * "the demo is still there six months later and a customer believes a
 * draw happened that did not".
 *
 * It writes a winners row like any other draw, including a seed and a
 * frozen pool that genuinely reproduce, so the presentation and the
 * verification page both work against it. A fake that is inconsistent
 * with the real audit trail would teach the owner the wrong thing about
 * what he is looking at.
 */
export async function seedDemoGame(): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  if (session.role !== "owner") return refuseManager(session, "create the demo game");
  const { sb } = session;
  const actor = session.name;

  const { data: existing } = await sb
    .from("games")
    .select("id")
    .ilike("title", `${DEMO_GAME_PREFIX}%`)
    .limit(1);
  if (existing?.length) {
    return {
      status: "error",
      message: "A demo drop already exists. Delete that one first.",
    };
  }

  const TOTAL = 25;
  const { data: game, error } = await sb
    .from("games")
    .insert({
      title: `${DEMO_GAME_PREFIX} Example Rifle Drop`,
      description:
        "A demonstration, not a real drop. Nothing was sold and nobody won. Delete it from the Drops list whenever you like.",
      total_spots: TOTAL,
      spot_price_cents: 2500,
      status: "drawn",
      created_by_name: actor,
      updated_by_name: actor,
    })
    .select("id")
    .single();
  if (error || !game) {
    logDbError("seedDemoGame", error);
    return { status: "error", message: "Could not create the demo drop." };
  }

  const spots = Array.from({ length: TOTAL }, (_, i) => ({
    game_id: game.id,
    spot_number: i + 1,
    status: "sold",
    first_name: "Demo",
    last_name: "Buyer",
    email: "demo@example.invalid",
    sold_at: new Date().toISOString(),
  }));
  const { data: written, error: spotError } = await sb
    .from("game_spots")
    .insert(spots)
    .select("id, spot_number");
  if (spotError || !written) {
    logDbError("seedDemoGame game_spots", spotError);
    await sb.from("games").delete().eq("id", game.id);
    return { status: "error", message: "Could not create the demo guides." };
  }

  // A real seed over the real pool, so the recorded result verifies the
  // same way a genuine draw does.
  const seed = newSeed();
  const pool = [...written]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((s) => ({ spot_id: s.id, spot_number: s.spot_number }));
  const result = selectWinner(pool.map((s) => ({ id: s.spot_id, weight: 1 })), seed);
  const winningSpot = pool.find((s) => s.spot_id === result?.entrantId);
  if (!result || !winningSpot) {
    await sb.from("games").delete().eq("id", game.id);
    return { status: "error", message: "Could not draw the demo drop." };
  }

  const { error: winnerError } = await sb.from("winners").insert({
    game_id: game.id,
    spot_id: winningSpot.spot_id,
    display_name: "Demo B.",
    seed,
    ticket: winningSpot.spot_number,
    ticket_index: result.ticket,
    pool: pool as unknown as Json,
    entry_total: result.total,
    drawn_early: false,
    unsold_spots: 0,
  });
  if (winnerError) {
    logDbError("seedDemoGame winner", winnerError);
    await sb.from("games").delete().eq("id", game.id);
    return { status: "error", message: "Could not record the demo winner." };
  }

  await logActivity(sb, session, {
    action: "create", entity: "game", entityId: game.id,
    entityLabel: `${DEMO_GAME_PREFIX} Example Rifle Drop`,
  });
  revalidatePublic();
  revalidatePath("/admin/games");
  return {
    status: "success",
    message: "Demo drop created. It is marked DEMO everywhere it appears.",
  };
}

/** Removes the demo game and everything hanging off it. */
export async function deleteDemoGame(): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  if (session.role !== "owner") return refuseManager(session, "delete the demo game");
  const { sb } = session;

  const { data: games } = await sb
    .from("games")
    .select("id, title")
    .ilike("title", `${DEMO_GAME_PREFIX}%`);
  if (!games?.length) {
    return { status: "error", message: "There is no demo drop to remove." };
  }
  for (const g of games) {
    // Order matters: winners and spots both point at the game.
    await sb.from("winners").delete().eq("game_id", g.id);
    await sb.from("game_spots").delete().eq("game_id", g.id);
    const { error } = await sb.from("games").delete().eq("id", g.id);
    if (error) {
      logDbError("deleteDemoGame", error);
      return { status: "error", message: "Could not remove the demo drop." };
    }
    await logActivity(sb, session, {
      action: "delete", entity: "game", entityId: g.id, entityLabel: g.title,
    });
  }
  revalidatePublic();
  revalidatePath("/admin/games");
  return { status: "success", message: "Demo drop removed." };
}

// ---------------------------------------------------------------------
// Who gets alerts
// ---------------------------------------------------------------------

/**
 * The two recipient lists. Owner only: the database refuses a manager's
 * write to settings, and this refuses first so he is told why.
 */
export async function saveAlertRouting(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  if (session.role !== "owner") return refuseManager(session, "change alert recipients");
  const { sb } = session;

  const next = { ...EMPTY_ROUTING };
  for (const group of ["problems", "routine"] as const) {
    const parsed = parseRecipients(String(formData.get(group) ?? ""));
    if (!parsed.ok) {
      return { status: "error", message: `"${parsed.bad}" is not an email address.` };
    }
    if (parsed.list.length > MAX_RECIPIENTS) {
      return { status: "error", message: `At most ${MAX_RECIPIENTS} addresses per list.` };
    }
    next[group] = parsed.list;
  }

  const current = readRouting(
    (await sb.from("settings").select("value").eq("key", ALERT_ROUTING_KEY).maybeSingle())
      .data?.value,
  );
  const ok = await writeSetting(sb, ALERT_ROUTING_KEY, next as unknown as Json, session.name);
  if (!ok) return { status: "error", message: "Save failed. Try again." };

  for (const group of ["problems", "routine"] as const) {
    if (current[group].join(",") === next[group].join(",")) continue;
    await logActivity(sb, session, {
      action: "alerts", entity: "settings", entityLabel: "Alert recipients",
      field: group, before: current[group].join(", ") || null,
      after: next[group].join(", ") || null,
    });
  }
  revalidatePath("/admin/team");
  return { status: "idle", message: "Saved." };
}

/**
 * Sends a test through the real transport and reports what came back.
 *
 * The point is the report. "Sent" proves only that the script accepted
 * it; whether the script honoured the recipient list is something only
 * the script can say, and one that has not been updated says nothing.
 */
export async function sendTestAlert(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  if (!session) return { status: "error", message: "Not signed in." };
  if (session.role !== "owner") return refuseManager(session, "send a test alert");
  const group = formData.get("group") === "problems" ? "problems" : "routine";

  const result = await sendAlert({ kind: "test_alert", group, requested_by: session.name });
  if (!result.sent) return { status: "error", message: `Not sent. ${result.reason}` };

  const asked = result.requested.length ? result.requested.join(", ") : null;
  if (result.deliveredTo === null) {
    return {
      status: "error",
      message: asked
        ? `The script accepted it but did not say who it sent to, so it has not been updated to use this list. It went to its usual address, not to ${asked}. See docs/email.md.`
        : "The script accepted it and did not say who it sent to. It went to its usual address.",
    };
  }
  const got = result.deliveredTo.join(", ") || "nobody";
  if (asked && result.requested.some((a) => !result.deliveredTo!.includes(a))) {
    return { status: "error", message: `Asked for ${asked}. The script says it sent to ${got}.` };
  }
  return { status: "success", message: `Sent. The script says it went to ${got}.` };
}
