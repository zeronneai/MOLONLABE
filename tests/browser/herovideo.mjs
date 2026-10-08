// The hero: the Molon Labe Recap, one cut per orientation.
//
// What a visitor gets, checked in a real browser: the right cut for how
// the screen is held, sized and silent from Cloudinary (never the 109MB
// upload), actually playing, muted and looping, with the headline and
// buttons there without scrolling; paused off screen; the first frame as
// a still when autoplay is refused, and only the still for reduced motion.
//
// Cloudinary is not reached from here. The video requests are answered
// with a short WebM recorded in the browser itself (test Chromium has no
// H.264), so "it plays" is a real playback, not an attribute check.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, ARTIFACTS } from "../lib/config.mjs";
import { browser, suite } from "../lib/harness.mjs";

const { check, report } = suite();
const SHOTS = join(ARTIFACTS, "herovideo");
mkdirSync(SHOTS, { recursive: true });

const PC = "f_auto,q_auto,vc_auto,ac_none,w_1600/v1791415684/Molon_Labe_Recap_horizontal_coywok.mp4";
const PHONE = "f_auto,q_auto,vc_auto,ac_none,w_900/v1791415687/Molon_Labe_Recap__vertical_onjniu.mp4";
const PC_STILL = "so_0,f_webp,q_auto,w_1600/v1791415684/Molon_Labe_Recap_horizontal_coywok.webp";
const PHONE_STILL = "so_0,f_webp,q_auto,w_900/v1791415687/Molon_Labe_Recap__vertical_onjniu.webp";

const b = await browser();

// A two-second WebM and a PNG, made in the browser.
const gen = await b.newPage();
const media = await gen.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 320; c.height = 180;
  const x = c.getContext("2d");
  let n = 0;
  const paint = () => {
    x.fillStyle = `hsl(${(n++ * 7) % 360} 60% 40%)`;
    x.fillRect(0, 0, 320, 180);
  };
  const timer = setInterval(paint, 33);
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
  const parts = [];
  rec.ondataavailable = (e) => parts.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start();
  await new Promise((r) => setTimeout(r, 2000));
  rec.stop();
  await done;
  clearInterval(timer);
  const webm = new Uint8Array(await new Blob(parts).arrayBuffer());
  paint();
  const png = c.toDataURL("image/png").split(",")[1];
  let s = "";
  for (const byte of webm) s += String.fromCharCode(byte);
  return { webm: btoa(s), png };
});
await gen.close();
const WEBM = Buffer.from(media.webm, "base64");
const PNG = Buffer.from(media.png, "base64");

/** A home page visit; every Cloudinary request recorded and answered. */
async function visit({ viewport, reducedMotion, refuseVideo = false } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion });
  await ctx.addInitScript(() => localStorage.setItem("mlf_age_ok", "1"));
  const requests = [];
  await ctx.route("**res.cloudinary.com/**", (route) => {
    const url = route.request().url();
    requests.push(url);
    if (url.endsWith(".mp4")) {
      return refuseVideo
        ? route.fulfill({ status: 404, body: "" })
        : route.fulfill({ status: 200, contentType: "video/webm", body: WEBM });
    }
    return route.fulfill({
      status: 200, contentType: "image/png", body: PNG,
      headers: { "access-control-allow-origin": "*" },
    });
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${APP}/`, { waitUntil: "domcontentloaded" });
  // Past the intro game, as a visitor would.
  const skip = p.getByRole("button", { name: /^SKIP/ });
  if (await skip.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false)) {
    await skip.click();
  }
  await p.waitForTimeout(1500);
  return { ctx, p, requests, errors };
}
const playing = (p) =>
  p.locator("[data-hero-video]").evaluate((v) => !v.paused && v.currentTime > 0).catch(() => false);
const waitPlaying = async (p) => {
  for (let i = 0; i < 20; i++) {
    if (await playing(p)) return true;
    await p.waitForTimeout(250);
  }
  return false;
};

// ------------------------------------------------------------- PC
{
  const { ctx, p, requests, errors } = await visit({ viewport: { width: 1280, height: 800 } });
  const video = p.locator("[data-hero-video]");
  check("PC: the horizontal recap, sized and silent from Cloudinary",
    (await video.getAttribute("src"))?.endsWith(PC), await video.getAttribute("src"));
  check("PC: the first paint is the horizontal recap's first frame",
    (await p.locator("[data-hero-poster]").getAttribute("src"))?.endsWith(PC_STILL));
  const attrs = await video.evaluate((v) => ({
    muted: v.muted, loop: v.loop, inline: v.playsInline, auto: v.autoplay, controls: v.controls,
  }));
  check("muted, looping, inline, autoplaying, no controls",
    attrs.muted && attrs.loop && attrs.inline && attrs.auto && !attrs.controls, JSON.stringify(attrs));
  check("PC: it really plays", await waitPlaying(p));
  check("and is visible once playing (faded in over the still)",
    (await video.evaluate((v) => getComputedStyle(v).opacity)) === "1");
  const hero = await p.locator("[data-hero]").boundingBox();
  check("the hero is one screen tall: no scroll needed, none consumed", Math.abs((hero?.height ?? 0) - 800) <= 1,
    String(hero?.height));
  const inView = async (loc) => {
    const box = await loc.boundingBox();
    return Boolean(box) && box.y >= 0 && box.y + box.height <= 800 && (await loc.isVisible());
  };
  check("the headline and both buttons are on screen at once, without scrolling",
    (await inView(p.locator("[data-hero] h1"))) &&
      (await inView(p.getByRole("link", { name: "View Inventory" }))) &&
      (await inView(p.locator("[data-hero] .cta-secondary"))));
  await p.screenshot({ path: join(SHOTS, "pc.png") });

  const mp4s = requests.filter((u) => u.endsWith(".mp4"));
  check("the only video requested is the sized, silent one: never the raw upload",
    mp4s.length > 0 && mp4s.every((u) => u.endsWith(PC)), JSON.stringify([...new Set(mp4s)]));
  check("the phone cut is not downloaded on a PC", !requests.some((u) => u.includes("vertical")));

  await p.mouse.wheel(0, 3000);
  await p.waitForTimeout(800);
  check("scrolled away, it pauses", await video.evaluate((v) => v.paused));
  await p.evaluate(() => window.scrollTo(0, 0));
  check("back at the top, it plays again", await waitPlaying(p));
  check("no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------- phone
{
  const { ctx, p, requests } = await visit({ viewport: { width: 390, height: 844 } });
  const video = p.locator("[data-hero-video]");
  check("phone held upright: the vertical recap", (await video.getAttribute("src"))?.endsWith(PHONE),
    await video.getAttribute("src"));
  check("and its first frame paints first",
    (await p.locator("[data-hero-poster]").evaluate((img) => img.currentSrc)).endsWith(PHONE_STILL));
  check("phone: it really plays", await waitPlaying(p));
  check("the PC cut is not downloaded on the phone", !requests.some((u) => u.includes("horizontal") && u.endsWith(".mp4")));
  await p.screenshot({ path: join(SHOTS, "phone.png") });

  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(800);
  check("turned sideways: the horizontal recap", (await video.getAttribute("src"))?.endsWith(PC));
  check("and it plays", await waitPlaying(p));
  await ctx.close();
}

// ------------------------------------------------------------- refused
{
  const { ctx, p } = await visit({ viewport: { width: 1280, height: 800 }, refuseVideo: true });
  check("video unavailable (or autoplay refused): the still shows, never a black box",
    (await p.locator("[data-hero-poster]").isVisible()) &&
      (await p.locator("[data-hero-video]").evaluate((v) => getComputedStyle(v).opacity)) === "0");
  check("and the headline is still there", await p.locator("[data-hero] h1").isVisible());
  await ctx.close();
}

// ------------------------------------------------------------- reduced motion
{
  const { ctx, p, requests } = await visit({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  check("reduced motion: no video at all", (await p.locator("[data-hero-video]").count()) === 0);
  check("not even downloaded", !requests.some((u) => u.endsWith(".mp4")));
  check("the still and the headline instead",
    (await p.locator("[data-hero-poster]").isVisible()) && (await p.locator("[data-hero] h1").isVisible()));
  await ctx.close();
}

await b.close();
report();
