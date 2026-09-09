#!/usr/bin/env node
// Shoots every frame the walkthrough needs, from a running site.
//
//   BASE_URL=https://your-preview.vercel.app \
//   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD=... \
//   node scripts/walkthrough/capture.mjs
//
// Point it at the DEPLOYED preview, not a local dev server: the whole
// value of this document is that the photographs and the stock in it are
// the real ones. Frames land in docs/walkthrough-frames/, which
// build.mjs then lays out.
//
// Admin credentials are optional. Without them sections 7 and 8 are
// skipped and the document shows those panels as pending rather than
// inventing them.
//
// Requires Playwright: npx playwright install chromium

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const OUT = path.resolve("docs/walkthrough-frames");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

if (!BASE) {
  console.error(
    "BASE_URL is required.\n\n" +
      "  BASE_URL=https://your-preview.vercel.app node scripts/walkthrough/capture.mjs\n",
  );
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const done = [];
const skipped = [];

const browser = await chromium.launch();

/**
 * A context with the age gate already answered.
 *
 * The intro game no longer has a "seen" flag to set — it runs on every
 * load by design — so pages that are not about the game have to skip past
 * it. `dismissIntro` does that after each navigation.
 */
async function seen(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.localStorage.setItem("mlf_age_ok", "1");
  });
  return ctx;
}

/** Clears the intro overlay if it is up. Safe to call when it is not. */
async function dismissIntro(page) {
  const skip = page.getByRole("button", { name: /^SKIP/ });
  try {
    await skip.waitFor({ state: "visible", timeout: 8000 });
    await skip.click();
    await page.waitForTimeout(1200);
  } catch {
    // Not showing — reduced motion, an asset failure, or already closed.
  }
}

async function shoot(page, id, opts = {}) {
  const file = path.join(OUT, `${id}.png`);
  await page.screenshot({ path: file, ...opts });
  done.push(id);
  console.log(`  captured ${id}`);
}

async function section(name, fn) {
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ! ${name} failed: ${err.message}`);
  }
}

// -------------------------------------------------- 01 the intro game
await section("01 intro game", async () => {
  // Deliberately a fresh context: the game only runs on a first visit.
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".intro-canvas", { timeout: 20000 });
  // Let the round get going, then put the crosshair on the field and
  // take some shots so the frame has a hit in it.
  await page.waitForTimeout(2200);
  const box = await page.locator(".intro-canvas").boundingBox();
  if (box) {
    for (const [dx, dy] of [
      [0.5, 0.55],
      [0.35, 0.45],
      [0.62, 0.6],
    ]) {
      await page.mouse.move(box.x + box.width * dx, box.y + box.height * dy);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(280);
    }
    await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.5);
  }
  await page.waitForTimeout(200);
  await shoot(page, "game");
  await ctx.close();
});

// ----------------------------------------------------- 02 the age gate
await section("02 age gate", async () => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  // Age not yet answered, so the gate stands on its own once the game
  // has been skipped below.
  await ctx.addInitScript(() => {
    window.localStorage.removeItem("mlf_age_ok");
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  // The game runs first even here; skip it so the gate stands alone.
  await dismissIntro(page);
  await page.waitForTimeout(2000);
  await shoot(page, "agegate");
  await ctx.close();
});

// ------------------------------------------------ 03 the hero pullback
await section("03 hero", async () => {
  const ctx = await seen({ width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await dismissIntro(page);
  await page.waitForTimeout(2000);
  // Three points across the scrub so the pull-back reads as a sequence.
  const stops = [0, 0.45, 0.9];
  for (let i = 0; i < stops.length; i++) {
    await page.evaluate((f) => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, h * f);
    }, stops[i] * 0.35);
    await page.waitForTimeout(1400);
    await shoot(page, `hero-${i + 1}`);
  }
  await ctx.close();
});

// -------------------------------------------------- 04 inventory index
await section("04 inventory", async () => {
  const ctx = await seen({ width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  await dismissIntro(page);
  await page.waitForTimeout(1200);
  // Hover a row so the panel on the right is showing something.
  const row = page.locator(".edx-row").nth(1);
  if (await row.count()) {
    await row.hover();
    await page.waitForTimeout(900);
  }
  await shoot(page, "inventory");
  await ctx.close();
});

// -------------------------------------------------------- 05 item page
await section("05 item detail", async () => {
  const ctx = await seen({ width: 1440, height: 1000 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
  await dismissIntro(page);
  const href = await page
    .locator('a[href^="/inventory/"]')
    .first()
    .getAttribute("href");
  if (!href) throw new Error("no inventory item to open");
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await shoot(page, "item-top");
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(1000);
  await shoot(page, "item-scrolled");
  await ctx.close();
});

// ---------------------------------------------------- 06 featured page
await section("06 featured", async () => {
  const ctx = await seen({ width: 1440, height: 1000 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/featured`, { waitUntil: "networkidle" });
  await dismissIntro(page);
  await page.waitForTimeout(1600);
  await shoot(page, "featured-top");
  const form = page.locator("form").last();
  if (await form.count()) {
    await form.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
  } else {
    await page.evaluate(() => window.scrollBy(0, 1400));
    await page.waitForTimeout(900);
  }
  await shoot(page, "featured-entry");
  await ctx.close();
});

// --------------------------------------------- 07 & 08 owner-only work
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log(
    "\n07 admin, 08 draw — SKIPPED (set ADMIN_EMAIL and ADMIN_PASSWORD to include them)",
  );
  skipped.push("admin-inventory", "admin-upload", "admin-game");
  skipped.push("draw-pool", "draw-spin", "draw-lock");
} else {
  let campaignId = process.env.DRAW_CAMPAIGN_ID ?? "";

  await section("07 admin at phone width", async () => {
    const ctx = await seen({ width: 390, height: 844 });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.locator("form button[type=submit], form button").first().click();
    await page.waitForTimeout(4000);

    await page.goto(`${BASE}/admin/inventory`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shoot(page, "admin-inventory");

    // The photo step, on an existing item so the uploader has content
    // around it rather than sitting on an empty form.
    const edit = await page
      .locator('a[href^="/admin/inventory/"]')
      .first()
      .getAttribute("href");
    if (edit && !edit.endsWith("/new")) {
      await page.goto(`${BASE}${edit}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const uploader = page.locator('input[type="file"]').first();
      if (await uploader.count()) await uploader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await shoot(page, "admin-upload");
    }

    await page.goto(`${BASE}/admin/game`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    await shoot(page, "admin-game");

    // Pick up a campaign for section 08 while we are still signed in.
    if (!campaignId) {
      await page.goto(`${BASE}/admin/featured`, { waitUntil: "networkidle" });
      const href = await page
        .locator('a[href^="/admin/featured/"]')
        .first()
        .getAttribute("href");
      const match = href?.match(/\/admin\/featured\/([0-9a-f-]{36})/i);
      if (match) campaignId = match[1];
    }

    await ctx.close();
  });

  await section("08 draw, rehearsal mode", async () => {
    if (!campaignId) throw new Error("no campaign found — set DRAW_CAMPAIGN_ID");

    const ctx = await seen({ width: 450, height: 800 });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    if (await page.locator('input[name="email"]').count()) {
      await page.fill('input[name="email"]', ADMIN_EMAIL);
      await page.fill('input[name="password"]', ADMIN_PASSWORD);
      await page.locator("form button[type=submit], form button").first().click();
      await page.waitForTimeout(4000);
    }

    await page.goto(`${BASE}/draw/${campaignId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    // Rehearsal, never a live draw. Shooting a real one would commit a
    // winner just to make a picture.
    await page.getByRole("button", { name: "Rehearsal" }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Start rehearsal" }).click();

    // The three beats: pool filled, mid-spin, locked and settled.
    await page.waitForTimeout(2100);
    await shoot(page, "draw-pool");
    await page.waitForTimeout(3200);
    await shoot(page, "draw-spin");
    await page.waitForTimeout(7000);
    await shoot(page, "draw-lock");

    await ctx.close();
  });
}

// The skull for the cover. Fetched here rather than hotlinked so the
// document renders identically offline and years from now.
await section("cover mark", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const src = await (async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    return page.locator("header img").first().getAttribute("src");
  })();
  if (src) {
    const url = src.startsWith("http") ? src : `${BASE}${src}`;
    const response = await page.request.get(url);
    if (response.ok()) {
      const { writeFile: wf } = await import("node:fs/promises");
      await wf(path.join(OUT, "mark.png"), await response.body());
      done.push("mark");
      console.log("  captured mark");
    }
  }
  await ctx.close();
});

await browser.close();

// ----------------------------------------------------------- manifest
// build.mjs reads this so the document can state honestly which panels
// came from a real capture and which are still pending.
await writeFile(
  path.join(OUT, "manifest.json"),
  JSON.stringify(
    { base: BASE, capturedAt: new Date().toISOString(), captured: done, skipped },
    null,
    2,
  ),
);

console.log(`\n${done.length} frames captured into ${OUT}`);
if (skipped.length) console.log(`${skipped.length} skipped: ${skipped.join(", ")}`);
console.log("\nNext: node scripts/walkthrough/build.mjs");
