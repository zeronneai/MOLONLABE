// The intro game: shows every load, rewards once.
//
// Cloudinary is unreachable from this sandbox, so the game's art is served
// by route interception. Two sprites are generated: one properly cut out,
// one a flat opaque rectangle, so the cutout detector is exercised in both
// directions — that detector is the only thing standing in for a check of
// the real asset that could not be made here.

import { chromium } from "playwright";
import { APP, CHROMIUM, DOUBLE } from "../lib/config.mjs";
import { artifacts } from "../lib/harness.mjs";


const SHOT = artifacts();

await fetch(`${DOUBLE}/__reset`);

const ok = [], bad = [];
const check = (l, pass, d = "") =>
  (pass ? ok : bad).push(`${pass ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());

const browser = await chromium.launch({ executablePath: CHROMIUM });

// --- generate the stand-in art ---------------------------------------------
const gen = await browser.newPage();
const art = await gen.evaluate(() => {
  const png = (w, h, draw) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    draw(x, w, h);
    return c.toDataURL("image/png").split(",")[1];
  };
  return {
    bg: png(1200, 750, (x, w, h) => {
      x.fillStyle = "#1a1c20"; x.fillRect(0, 0, w, h);
      // A bright band, so the backdrop luminance sampling has something
      // real to measure rather than a flat field.
      x.fillStyle = "#c9c4b4"; x.fillRect(0, h * 0.55, w, h * 0.12);
    }),
    cutout: png(200, 200, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = "#f2efe7";
      x.beginPath(); x.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2); x.fill();
    }),
    flat: png(200, 200, (x, w, h) => {
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, w, h);
      x.fillStyle = "#111"; x.fillRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4);
    }),
  };
});
await gen.close();

async function serveArt(ctx, spriteB64) {
  await ctx.route("**res.cloudinary.com/**", (route) => {
    const url = route.request().url();
    const isBg = url.includes("showroom") || url.includes("Firearms_showroom");
    route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
      body: Buffer.from(isBg ? art.bg : spriteB64, "base64"),
    });
  });
}

async function fresh(sprite = art.cutout, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  await ctx.addInitScript(() => window.localStorage.setItem("mlf_age_ok", "1"));
  await serveArt(ctx, sprite);
  return ctx;
}

const gameUp = (page) =>
  page.getByRole("button", { name: /^SKIP/ }).waitFor({ state: "visible", timeout: 15000 })
    .then(() => true).catch(() => false);

// --------------------------------------------- 1. shows on every load
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => bad.push(`PAGE ERROR ${e.message}`));

  await page.goto(APP, { waitUntil: "domcontentloaded" });
  check("the game runs on a first visit", await gameUp(page));
  await page.screenshot({ path: `${SHOT}/g1-first-load.png` });

  // The old behaviour: a second load used to skip it.
  await page.reload({ waitUntil: "domcontentloaded" });
  check("the game runs again on a reload", await gameUp(page));

  // ...but must NOT restart on an internal link.
  await page.getByRole("button", { name: /^SKIP/ }).click();
  await page.waitForTimeout(1400);
  await page.getByRole("link", { name: "Inventory" }).first().click();
  await page.waitForTimeout(2500);
  check("the game does NOT restart on internal navigation",
    !(await page.getByRole("button", { name: /^SKIP/ }).isVisible().catch(() => false)));

  // Escape is an exit too.
  //
  // Pressed more than once, and waited for rather than slept past. The
  // key handler is bound in an effect, which React runs AFTER paint, so
  // there is a window where SKIP is on screen and Escape is not yet
  // listened for. A single press plus a fixed 1400ms sleep landed inside
  // that window under load — this suite failed exactly once, in a full
  // run, and passed alone every time after.
  //
  // Retrying does not weaken what is being tested. The claim is that
  // Escape dismisses the game, and a regression where it does nothing
  // fails all three presses just as it failed one. What the retry
  // removes is a dependency on React's effect timing, which is not the
  // subject. Pressing escape twice is also what a person does when the
  // first one appears not to have worked.
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await gameUp(page);
  const skipBtn = page.getByRole("button", { name: /^SKIP/ });
  let skipped = false;
  for (let attempt = 0; attempt < 3 && !skipped; attempt++) {
    await page.keyboard.press("Escape");
    skipped = await skipBtn
      .waitFor({ state: "hidden", timeout: 2000 })
      .then(() => true)
      .catch(() => false);
  }
  check("escape skips the round", skipped);

  await ctx.close();
}

// -------------------------------------- 2. the cutout check, both ways
{
  const ctx = await fresh(art.cutout);
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await gameUp(page);
  // Set once the sprite has decoded and been sampled, which is a frame
  // or two after the game appears. Wait for it rather than racing it.
  await page.waitForFunction(() => window.__mlfTargetCutout !== undefined,
    null, { timeout: 8000 }).catch(() => {});
  const clean = await page.evaluate(() => window.__mlfTargetCutout);
  check("a cut-out sprite is reported clean", clean?.clean === true, JSON.stringify(clean));
  await ctx.close();
}
{
  const ctx = await fresh(art.flat);
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await gameUp(page);
  await page.waitForFunction(() => window.__mlfTargetCutout !== undefined,
    null, { timeout: 8000 }).catch(() => {});
  const flat = await page.evaluate(() => window.__mlfTargetCutout);
  check("a flat opaque sprite is reported NOT clean", flat?.clean === false, JSON.stringify(flat));
  check("the flat sprite reports a fully opaque edge", (flat?.opaqueEdge ?? 0) > 0.9);
  await ctx.close();
}

// ------------------------------------------ 3. the reward, once only
async function winARound(page) {
  // The anchors the targets rise at, from lib/game/assets.ts. Clicking
  // through them repeatedly lands hits without needing to see the canvas.
  const anchors = [
    [0.16, 0.78], [0.85, 0.8], [0.31, 0.6], [0.7, 0.59],
    [0.5, 0.47], [0.42, 0.5], [0.6, 0.68], [0.07, 0.63],
  ];
  const box = await page.locator(".intro-canvas").boundingBox();
  if (!box) return false;
  const deadline = Date.now() + 22000;
  while (Date.now() < deadline) {
    for (const [ax, ay] of anchors) {
      // Aim a little above the cover line: that is where the sprite body is.
      await page.mouse.click(box.x + box.width * ax, box.y + box.height * (ay - 0.06));
      if (await page.locator(".intro-result").isVisible().catch(() => false)) return true;
    }
    await page.waitForTimeout(60);
  }
  return page.locator(".intro-result").isVisible().catch(() => false);
}

{
  const ctx = await fresh();
  const page = await ctx.newPage();

  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await gameUp(page);
  const won = await winARound(page);
  check("a round can be won", won);
  if (won) {
    await page.waitForTimeout(900);
    const card = await page.locator(".intro-result").innerText();
    const isWin = has(card, "Cleared");
    check("the first win issues the code", isWin && has(card, "MOLON10"),
      card.replace(/\n/g, " ").slice(0, 90));
    await page.screenshot({ path: `${SHOT}/g2-first-win.png` });

    const claimed = await page.evaluate(() =>
      window.localStorage.getItem("mlf_intro_code_claimed"));
    check("the claim is recorded", claimed === "1", String(claimed));

    // Same browser, fresh load: still plays, no second code.
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    check("a claimed player still gets to play", await gameUp(page));
    const wonAgain = await winARound(page);
    check("a claimed player can still win", wonAgain);
    if (wonAgain) {
      await page.waitForTimeout(900);
      const second = await page.locator(".intro-result").innerText();
      check("a repeat win does NOT reissue the code", !has(second, "MOLON10"),
        second.replace(/\n/g, " ").slice(0, 90));
      check("a repeat win says the code is already claimed",
        has(second, "already claimed"), second.replace(/\n/g, " ").slice(0, 90));
      await page.screenshot({ path: `${SHOT}/g3-repeat-win.png` });
    }
  }
  await ctx.close();
}

// ------------------------------- 4. reduced motion still skips it all
{
  const ctx = await fresh(art.cutout, { reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("reduced motion still skips the game entirely",
    !(await page.getByRole("button", { name: /^SKIP/ }).isVisible().catch(() => false)));
  await ctx.close();
}

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
