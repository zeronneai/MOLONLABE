// How much does the always-on intro cost a returning visitor?
//
// Cloudinary is unreachable here, so the art is served locally at sizes
// chosen to match what the real assets are budgeted at in
// lib/game/assets.ts (background <=2000px, sprites <=900px, ~700KB total).
// The network is then throttled to a slow-4G profile. This is an
// approximation, not a measurement of the real CDN — but the request
// count and the shape of the wait are exact.

import { chromium } from "playwright";
import { APP, CHROMIUM } from "../lib/config.mjs";


const browser = await chromium.launch({ executablePath: CHROMIUM });

// Stand-in art at realistic weights. Noise, so PNG cannot compress it away.
const gen = await browser.newPage();
const art = await gen.evaluate(() => {
  const noisy = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    const img = x.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 20 + Math.random() * 200;
      img.data[i] = v; img.data[i + 1] = v * 0.9; img.data[i + 2] = v * 0.8;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL("image/jpeg", 0.7).split(",")[1];
  };
  const sprite = () => {
    const c = document.createElement("canvas");
    c.width = 500; c.height = 500;
    const x = c.getContext("2d");
    x.clearRect(0, 0, 500, 500);
    for (let i = 0; i < 7000; i++) {
      x.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},60,0.6)`;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 180;
      x.fillRect(250 + Math.cos(a) * r, 250 + Math.sin(a) * r, 4, 4);
    }
    return c.toDataURL("image/png").split(",")[1];
  };
  return { bg: noisy(1100, 690), sprite: sprite(), stub: noisy(8, 8) };
});
await gen.close();

const bgBuf = Buffer.from(art.bg, "base64");
const spriteBuf = Buffer.from(art.sprite, "base64");
// The hero's scroll-scrub pulls dozens of frames from the same CDN. They
// are not the game's cost and must not be counted as it, so they are
// served as stubs.
const stubBuf = Buffer.from(art.stub, "base64");
console.log(
  `stand-in weights: background ${(bgBuf.length / 1024) | 0}KB, ` +
    `sprite ${(spriteBuf.length / 1024) | 0}KB`,
);

async function run(label, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => window.localStorage.setItem("mlf_age_ok", "1"));

  let gameRequests = 0;
  let gameBytes = 0;
  await ctx.route("**res.cloudinary.com/**", async (route) => {
    const url = route.request().url();
    const isBg = url.includes("showroom");
    const isTarget = url.includes("ChatGPT_Image");
    const isPistol = url.includes("pistol_1");
    const isGame = isBg || isTarget || isPistol;
    const body = isBg ? bgBuf : isGame ? spriteBuf : stubBuf;
    if (isGame) {
      gameRequests++;
      gameBytes += body.length;
    }
    await route.fulfill({
      status: 200,
      contentType: isBg ? "image/jpeg" : "image/png",
      headers: { "access-control-allow-origin": "*" },
      body,
    });
  });

  const page = await ctx.newPage();
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      // Slow 4G: what a phone on a weak signal in El Paso actually gets.
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }

  const start = Date.now();
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  let skipAt = null;
  try {
    await page.getByRole("button", { name: /^SKIP/ })
      .waitFor({ state: "visible", timeout: 30000 });
    skipAt = Date.now() - start;
  } catch {
    // never appeared
  }
  // How long until the site is actually usable after choosing to skip.
  let usableAt = null;
  if (skipAt !== null) {
    await page.getByRole("button", { name: /^SKIP/ }).click();
    await page.locator(".intro-overlay").waitFor({ state: "detached", timeout: 15000 })
      .catch(() => {});
    usableAt = Date.now() - start;
  }

  console.log(
    `${label}\n` +
      `  game art requests   ${gameRequests}  (${(gameBytes / 1024) | 0}KB)\n` +
      `  skip available at   ${skipAt === null ? "never" : `${skipAt}ms`}\n` +
      `  site usable at      ${usableAt === null ? "n/a" : `${usableAt}ms`}`,
  );
  await ctx.close();
}

await run("unthrottled (desktop-class connection)", false);
await run("slow 4G, 150ms latency", true);

await browser.close();
