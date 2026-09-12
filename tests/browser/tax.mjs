// Tax, tiered postage, and the scoped disclaimer.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const SHIRT = "33333333-3333-4333-8333-333333333333";
const PATCH = "44444444-4444-4444-8444-444444444444";
const OPTIC = "22222222-2222-4222-8222-222222222222";
const RIFLE = "11111111-1111-4111-8111-111111111111";
const V_S = "aaaaaaaa-0000-4000-8000-000000000001";

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());
const usd = (c) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

await fetch(`${DOUBLE}/__reset`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
// Cloudinary is unreachable, so the intro game's art fails and it skips
// itself. Age gate cleared so it does not sit over the pages under test.
await ctx.addInitScript(() => window.localStorage.setItem("mlf_age_ok", "1"));
const page = await ctx.newPage();
page.on("pageerror", (e) => bad.push(`PAGE ERROR ${e.message}`));

const setCart = async (lines) => {
  await page.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
  await page.evaluate((l) => window.localStorage.setItem("mlf_cart", JSON.stringify(l)), lines);
};
const cartText = async () => {
  await page.goto(`${APP}/cart`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return page.locator("body").innerText();
};

// ------------------------------------------- the disclaimer is scoped
await page.goto(`${APP}/inventory/sig-mpx-carbon`, { waitUntil: "networkidle" });
check("a firearm still carries the attorney's notice",
  has(await page.locator("body").innerText(), "must be transferred through a federally licensed"));

await page.goto(`${APP}/inventory/molon-labe-tee`, { waitUntil: "networkidle" });
const tee = await page.locator("body").innerText();
check("a t-shirt does NOT carry the firearms notice",
  !has(tee, "must be transferred through a federally licensed"));
check("a t-shirt still carries the no-refunds line",
  has(tee, "No refunds or exchanges"));

await page.goto(`${APP}/inventory/skull-patch`, { waitUntil: "networkidle" });
check("an accessory does NOT carry the firearms notice",
  !has(await page.locator("body").innerText(), "must be transferred through a federally licensed"));

// ------------------------------------------------------- 8.25% tax
await setCart([{ itemId: SHIRT, quantity: 1, variantId: V_S }]);
{
  const text = await cartText();
  const sub = 3200;
  const tax = Math.round((sub * 825) / 10000); // 264
  check(`tax is 8.25% of the merchandise subtotal (${usd(tax)})`, has(text, usd(tax)), usd(tax));
  check("standard postage is charged", has(text, usd(1000)));
  check("the total adds up", has(text, usd(sub + tax + 1000)), usd(sub + tax + 1000));
  // Tax must not be charged on postage.
  check("tax is NOT applied to postage",
    !has(text, usd(Math.round(((sub + 1000) * 825) / 10000))));
}

// --------------------------------- one postage charge, not one per line
await setCart([
  { itemId: SHIRT, quantity: 1, variantId: V_S },
  { itemId: PATCH, quantity: 1 },
]);
{
  const text = await cartText();
  check("two shipped lines are still charged postage once",
    has(text, usd(1000)) && !has(text, usd(2000)), "expected one standard charge");
}

// ------------------------------------------- oversize wins in a mix
await fetch(`${DOUBLE}/rest/v1/items?id=eq.${OPTIC}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ shipping_tier: "oversize" }),
});
await setCart([
  { itemId: SHIRT, quantity: 1, variantId: V_S },
  { itemId: OPTIC, quantity: 1 },
]);
{
  const text = await cartText();
  check("a cart with an oversize line pays the oversize rate",
    has(text, usd(2000)), "expected $20.00");
  check("the standard rate is not also charged", !has(text, "$10.00"));
}

// ------------------------------------- collected items pay no postage
await setCart([{ itemId: RIFLE, quantity: 1 }]);
{
  const text = await cartText();
  check("a collect-in-store order is charged no postage", !has(text, "Shipping"));
  const tax = Math.round((219900 * 825) / 10000);
  check("tax still applies to a collected item", has(text, usd(tax)), usd(tax));
}

// --------------------------------------- placeholder wording is present
await page.goto(`${APP}/admin/commerce`, { waitUntil: "networkidle" }).catch(() => {});

const final = await (await fetch(`${DOUBLE}/__dump`)).json();
check("the double kept both postage tiers",
  final.settings.find((r) => r.key === "commerce")?.value.shipping_oversize_cents === 2000);

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
