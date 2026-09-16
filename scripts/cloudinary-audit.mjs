#!/usr/bin/env node
// Which product photographs are still on Cloudinary?
//
//   node scripts/cloudinary-audit.mjs          # reads .env.local
//   node scripts/cloudinary-audit.mjs --check  # also fetch each one
//
// WHY
//
// Product photographs moved to Supabase Storage, but the older catalogue
// entries still point at Cloudinary. Those are the only URLs in the
// guide's path that nothing here has ever been able to reach — every
// outbound host is blocked from the sandbox this was built in — so they
// are the last place a guide could quietly come out short.
//
// The admin now reports a shortfall against the game, so this is not the
// only way anybody would find out. It is the way to find out BEFORE a
// customer does, which is the difference worth having.
//
// WHAT IT PRINTS
//
// Every item with at least one Cloudinary image, marked with whether it
// is the prize in a game — because an item that is not a prize never
// reaches a guide, and the list is much shorter when you know which is
// which.
//
// `--check` fetches each URL and reports its status and content type, so
// a stacked transform or a dead asset shows up as itself rather than as
// a missing picture in a PDF three weeks later. It does NOT decode: this
// is about whether the bytes arrive.
//
// THE SAME QUESTION AS SQL, for the Supabase editor:
//
//   select i.slug, i.name, i.status, g.title as game, u as url
//   from items i
//   cross join lateral jsonb_array_elements_text(
//     case when jsonb_typeof(i.images) = 'array' then i.images else '[]'::jsonb end
//   ) u
//   left join games g on g.item_id = i.id
//   where u like '%res.cloudinary.com%'
//   order by (g.id is null), i.name;
//
// Exit codes: 0 nothing on Cloudinary (or all reachable under --check),
// 1 something needs looking at, 2 could not check.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const doFetch = process.argv.includes("--check");

/** Values from the environment, falling back to .env.local. */
function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const file = readFileSync(join(ROOT, ".env.local"), "utf8");
    const hit = file.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
    if (hit) return hit[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env.local is normal in CI */
  }
  return null;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Both are already in .env.local for a working site.",
  );
  process.exit(2);
}

const base = url.replace(/\/$/, "");
const headers = { apikey: key, authorization: `Bearer ${key}` };

async function table(path) {
  const res = await fetch(`${base}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    console.error(`${path} returned ${res.status}. Is that the service-role key?`);
    process.exit(2);
  }
  return res.json();
}

const [items, games] = await Promise.all([
  table("items?select=id,slug,name,status,images"),
  table("games?select=id,title,status,item_id"),
]);

const gameOf = new Map();
for (const g of games) if (g.item_id) gameOf.set(g.item_id, g);

const CLOUDINARY = "res.cloudinary.com";
const rows = [];
for (const item of items) {
  const images = Array.isArray(item.images)
    ? item.images.filter((u) => typeof u === "string")
    : [];
  const cloud = images.filter((u) => u.includes(CLOUDINARY));
  if (cloud.length === 0) continue;
  rows.push({ item, images, cloud, game: gameOf.get(item.id) ?? null });
}

if (rows.length === 0) {
  console.log(
    `No item references Cloudinary. All ${items.length} items are on Supabase Storage.`,
  );
  process.exit(0);
}

// Prizes first: they are the only ones that ever reach a guide.
rows.sort((a, b) => Number(Boolean(b.game)) - Number(Boolean(a.game)));

const prizes = rows.filter((r) => r.game);
console.log(
  `${rows.length} item(s) reference Cloudinary, ` +
    `${prizes.length} of which ${prizes.length === 1 ? "is" : "are"} a prize in a game.\n`,
);

let unreachable = 0;

for (const { item, images, cloud, game } of rows) {
  const where = game
    ? `PRIZE in "${game.title}" (${game.status})`
    : "not in a game — never reaches a guide";
  console.log(`${item.name}  [${item.slug}] — ${item.status}`);
  console.log(`  ${where}`);
  console.log(`  ${cloud.length} of ${images.length} image(s) on Cloudinary`);
  for (const u of cloud) {
    if (!doFetch) {
      console.log(`    ${u}`);
      continue;
    }
    // The same URL the guide would ask for, transform and all, so a
    // stacked transform fails here rather than in a PDF.
    const asked = guideImageUrl(u);
    try {
      const res = await fetch(asked, { signal: AbortSignal.timeout(10_000) });
      const type = res.headers.get("content-type") ?? "?";
      const ok = res.ok;
      if (!ok) unreachable++;
      console.log(`    ${ok ? "OK " : "DEAD"} ${res.status} ${type}  ${asked}`);
    } catch (error) {
      unreachable++;
      console.log(`    DEAD ${String(error.message ?? error).slice(0, 60)}  ${asked}`);
    }
  }
  console.log("");
}

/**
 * Kept in step with lib/guides/images.ts by hand, and small enough that
 * that is honest: this script is plain node with no TypeScript
 * toolchain, so it cannot import the real one. If the transform there
 * changes, change it here — the point of `--check` is to ask for exactly
 * what the guide asks for.
 */
function guideImageUrl(u) {
  if (!u.includes(CLOUDINARY)) return u;
  if (!u.includes("/upload/")) return u;
  if (/\/upload\/[^/]*[,_][^/]*\//.test(u)) return u;
  return u.replace("/upload/", "/upload/q_auto:good,w_1400/");
}

if (!doFetch) {
  console.log("Run again with --check to fetch each one and see what comes back.");
  process.exit(prizes.length > 0 ? 1 : 0);
}

console.log(
  unreachable === 0
    ? "Every Cloudinary image answered. Nothing here will come out blank."
    : `${unreachable} image(s) did not answer. Those are the ones to re-upload.`,
);
process.exit(unreachable > 0 ? 1 : 0);
