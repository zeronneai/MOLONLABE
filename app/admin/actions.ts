"use server";

// Admin mutations. Every action runs on the owner's session client, so
// RLS enforces `authenticated` — there is no service-role use here.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionSupabase } from "@/lib/supabase/session";
import { slugify } from "@/lib/slug";
import type { Database, Json } from "@/lib/database.types";
import {
  CATEGORIES,
  CAMPAIGN_STATUSES,
  DEFAULT_EXCLUSION_NOTE,
  ITEM_STATUSES,
  type ActionState,
} from "@/lib/admin/constants";
import { DIFFICULTY_RANGES } from "@/lib/game/settings";

export type { ActionState };

async function requireClient(): Promise<SupabaseClient<Database> | null> {
  const sb = await getSessionSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? sb : null;
}

function revalidatePublic(slug?: string) {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/featured");
  if (slug) revalidatePath(`/inventory/${slug}`);
}

export async function setItemStatus(id: string, status: string): Promise<void> {
  const sb = await requireClient();
  if (!sb || !ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number])) return;
  const { error } = await sb.from("items").update({ status }).eq("id", id);
  if (error) console.error("setItemStatus:", error.message);
  revalidatePublic();
  revalidatePath("/admin/inventory");
}

export async function toggleItemFeatured(id: string, next: boolean): Promise<void> {
  const sb = await requireClient();
  if (!sb) return;
  const { error } = await sb.from("items").update({ is_featured: next }).eq("id", id);
  if (error) console.error("toggleItemFeatured:", error.message);
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
  const suffix = Date.now().toString(36).slice(-4);
  const { error } = await sb.from("items").insert({
    slug: `${item.slug}-copy-${suffix}`,
    name: `${item.name} COPY`,
    category: item.category,
    brand: item.brand,
    short_desc: item.short_desc,
    long_desc: item.long_desc,
    specs: item.specs,
    price_display: item.price_display,
    status: "hidden", // duplicates start invisible
    is_featured: false,
    sort_order: (item.sort_order ?? 0) + 1,
    images: item.images,
    video_url: item.video_url,
  });
  if (error) console.error("duplicateItem:", error.message);
  revalidatePath("/admin/inventory");
}

export async function saveItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sb = await requireClient();
  if (!sb) return { status: "error", message: "Not signed in." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const status = String(formData.get("status") ?? "available");
  if (name.length < 2) return { status: "error", message: "Name is required." };
  if (!(CATEGORIES as readonly string[]).includes(category))
    return { status: "error", message: "Pick a category." };
  if (!ITEM_STATUSES.includes(status as (typeof ITEM_STATUSES)[number]))
    return { status: "error", message: "Bad status." };

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
    video_url: String(formData.get("video_url") ?? "").trim() || null,
    status,
    is_featured: formData.get("is_featured") === "on",
    specs: specs as Json,
    images,
  };

  const { error } = id
    ? await sb.from("items").update(row).eq("id", id)
    : await sb.from("items").insert(row);

  if (error) {
    console.error("saveItem:", error.message);
    return {
      status: "error",
      message: error.code === "23505" ? "That slug is taken." : "Save failed — try again.",
    };
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

export async function setCampaignStatus(id: string, status: string): Promise<void> {
  const sb = await requireClient();
  if (!sb || !CAMPAIGN_STATUSES.includes(status as (typeof CAMPAIGN_STATUSES)[number]))
    return;
  // One live campaign at a time: going live demotes any other live one.
  if (status === "live") {
    await sb.from("campaigns").update({ status: "closed" }).eq("status", "live").neq("id", id);
  }
  const { error } = await sb.from("campaigns").update({ status }).eq("id", id);
  if (error) console.error("setCampaignStatus:", error.message);
  revalidatePublic();
  revalidatePath("/admin/featured");
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
): Promise<boolean> {
  const { error } = await sb
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) console.error(`writeSetting ${key}:`, error.message);
  return !error;
}

function revalidateGame() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/game");
}

/** The kill switch: flips only `enabled`, touches nothing else. */
export async function toggleGameOffer(enabled: boolean): Promise<void> {
  const sb = await requireClient();
  if (!sb) return;
  const current = await readSetting(sb, "game_offer");
  await writeSetting(sb, "game_offer", { ...current, enabled } as Json);
  revalidateGame();
}

export async function saveGameOffer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sb = await requireClient();
  if (!sb) return { status: "error", message: "Not signed in." };

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
  } as Json);
  if (!ok) return { status: "error", message: "Save failed — try again." };
  revalidateGame();
  return { status: "idle", message: "Saved." };
}

export async function saveGameDifficulty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sb = await requireClient();
  if (!sb) return { status: "error", message: "Not signed in." };

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
  } as Json);
  if (!ok) return { status: "error", message: "Save failed — try again." };
  revalidateGame();
  return { status: "idle", message: "Saved." };
}

export async function saveCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sb = await requireClient();
  if (!sb) return { status: "error", message: "Not signed in." };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { status: "error", message: "Title is required." };

  const toIso = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const row = {
    title,
    item_id: String(formData.get("item_id") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    opens_at: toIso(formData.get("opens_at")),
    closes_at: toIso(formData.get("closes_at")),
    winner_note: String(formData.get("winner_note") ?? "").trim() || null,
  };

  const { error } = id
    ? await sb.from("campaigns").update(row).eq("id", id)
    : await sb.from("campaigns").insert({ ...row, status: "draft" });

  if (error) {
    console.error("saveCampaign:", error.message);
    return { status: "error", message: "Save failed — try again." };
  }
  revalidatePublic();
  revalidatePath("/admin/featured");
  redirect("/admin/featured");
}
