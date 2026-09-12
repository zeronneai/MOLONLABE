// Apparel and sizes, end to end through the real UI and server actions.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const SHOT = "/tmp/claude-0/-home-user-MOLONLABE/b4fc1675-b424-56e3-b391-8d89c8865437/scratchpad/shots";

const ok = [], bad = [];
const check = (label, pass, detail = "") =>
  (pass ? ok : bad).push(`${pass ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());
const dump = async () => (await fetch(`${DOUBLE}/__dump`)).json();

await fetch(`${DOUBLE}/__reset`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => {
  window.Accept = {
    dispatchData: (data, handler) =>
      handler({
        messages: { resultCode: "Ok", message: [] },
        opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "NONCE-OK" },
      }),
  };
  window.localStorage.setItem("mlf_age_ok", "1");
  window.localStorage.setItem("mlf_intro_seen", "1");
});
const page = await ctx.newPage();
page.on("pageerror", (e) => bad.push(`PAGE ERROR ${e.message}`));

// ------------------------------------------------ the two listings split
await page.goto(`${APP}/shop`, { waitUntil: "networkidle" });
const shopText = await page.locator("body").innerText();
check("shop lists the apparel", has(shopText, "Molon Labe Tee"));
check("shop lists the accessory", has(shopText, "Skull Patch"));
check("shop does NOT list firearms", !has(shopText, "SIG MPX"));
await page.screenshot({ path: `${SHOT}/a1-shop.png`, fullPage: true });

await page.goto(`${APP}/inventory`, { waitUntil: "networkidle" });
const invText = await page.locator("body").innerText();
check("inventory still lists firearms", has(invText, "SIG MPX"));
check("inventory does NOT list apparel", !has(invText, "Molon Labe Tee"));
check("inventory does NOT list accessories", !has(invText, "Skull Patch"));

check("Shop is in the navigation", has(invText, "Shop"));

// -------------------------------------------------- the size selector
await page.goto(`${APP}/inventory/molon-labe-tee`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const teeText = await page.locator("body").innerText();
check("sized item shows a size selector", has(teeText, "Size"));
check("every size is listed, sold out included", ["Small", "Medium", "Large"].every((s) => has(teeText, s)));

const large = page.getByRole("button", { name: /^Large/ });
check("the sold-out size is visible", (await large.count()) > 0);
check("the sold-out size is disabled", await large.isDisabled());
const small = page.getByRole("button", { name: /^Small/ });
check("an in-stock size is enabled", await small.isEnabled());

const addBtn = page.getByRole("button", { name: /Pick a size|Add to cart/ });
check("add is blocked until a size is chosen", await addBtn.isDisabled(),
  await addBtn.innerText());
await page.screenshot({ path: `${SHOT}/a2-item-sizes.png` });

await page.getByRole("button", { name: /^Medium/ }).click();
await page.waitForTimeout(200);
check("add unlocks once a size is chosen", await page.getByRole("button", { name: "Add to cart" }).isEnabled());

// A rifle must be untouched by any of this.
await page.goto(`${APP}/inventory/sig-mpx-carbon`, { waitUntil: "networkidle" });
const rifleText = await page.locator("body").innerText();
check("an unsized item shows no size selector", !/\bSIZE\b/.test(rifleText));
check("an unsized item can be added straight away",
  await page.getByRole("button", { name: "Add to cart" }).isEnabled());

// --------------------------------------------------- buy the last medium
await page.goto(`${APP}/inventory/molon-labe-tee`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Medium/ }).click();
await page.getByRole("button", { name: "Add to cart" }).click();
await page.waitForTimeout(400);

await page.goto(`${APP}/cart`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const cartText = await page.locator("body").innerText();
check("the cart carries the size", has(cartText, "Size Medium"));
check("the cart prices the shirt", has(cartText, "$32.00"));
await page.screenshot({ path: `${SHOT}/a3-cart.png`, fullPage: true });

await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const coText = await page.locator("body").innerText();
check("checkout summary shows the size", has(coText, "Medium"));

await page.fill("#firstName", "Dana");
await page.fill("#lastName", "Ruiz");
await page.fill("#email", "dana.ruiz@example.com");
await page.fill("#shipLine1", "1200 Texas Ave");
await page.fill("#shipCity", "El Paso");
await page.fill("#shipRegion", "TX");
await page.fill("#shipPostalCode", "79901");
await page.fill("#cardNumber", "4111111111111111");
await page.fill("#cardMonth", "12");
await page.fill("#cardYear", "2029");
await page.fill("#cardCode", "123");
await page.fill("#cardZip", "79901");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: /Pay \$/ }).click();
try { await page.waitForURL(/confirmation/, { timeout: 20000 }); } catch { console.log("NO NAV. url=", page.url()); console.log((await page.locator("body").innerText()).slice(0,1500)); process.exit(9); }
await page.waitForTimeout(800);

const confText = await page.locator("body").innerText();
check("the confirmation shows the size", has(confText, "Medium"));
await page.screenshot({ path: `${SHOT}/a4-confirmation.png`, fullPage: true });

const after = await dump();
const line = after.order_items[0];
check("the order line records the size", line?.size === "Medium", `got ${line?.size}`);
check("the order line records the variant id", Boolean(line?.variant_id));

const medium = after.item_variants.find((v) => v.size === "Medium");
const small2 = after.item_variants.find((v) => v.size === "Small");
check("the medium's stock decremented to 0", medium?.stock === 0, `got ${medium?.stock}`);
check("other sizes are untouched", small2?.stock === 4, `got ${small2?.stock}`);

const shirt = after.items.find((i) => i.slug === "molon-labe-tee");
check("the shirt itself is NOT marked sold", shirt?.status === "available", `got ${shirt?.status}`);

// ----------------------------------------- the sold-out size is now gone
await page.goto(`${APP}/inventory/molon-labe-tee`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const mediumBtn = page.getByRole("button", { name: /^Medium/ });
check("the just-emptied size is now disabled", await mediumBtn.isDisabled());
check("the emptied size still shows sold out",
  has(await mediumBtn.innerText(), "Sold out"));

// -------------------------------------- a stale cart cannot outrun stock
await page.evaluate(() => {
  window.localStorage.setItem(
    "mlf_cart",
    JSON.stringify([{ itemId: "33333333-3333-4333-8333-333333333333", quantity: 1,
      variantId: "aaaaaaaa-0000-4000-8000-000000000002" }]),
  );
});
await page.goto(`${APP}/cart`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const staleText = await page.locator("body").innerText();
check("a cart holding a sold-out size says so", has(staleText, "sold out"),
  staleText.slice(0, 120).replace(/\n/g, " "));

// A size-less post must be refused server-side, not just in the UI.
await page.evaluate(() => {
  window.localStorage.setItem(
    "mlf_cart",
    JSON.stringify([{ itemId: "33333333-3333-4333-8333-333333333333", quantity: 1 }]),
  );
});
await page.goto(`${APP}/cart`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
check("a sized item with no size chosen is refused",
  has(await page.locator("body").innerText(), "Pick a size"));

// ------------------- regression: the single-unit path still behaves
// The claim step was refactored to handle two kinds of stock; a rifle
// must still reserve exactly as it did before.
await fetch(`${DOUBLE}/__reset`);
await page.evaluate(() => window.localStorage.removeItem("mlf_cart"));
await page.goto(`${APP}/inventory/sig-mpx-carbon`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Add to cart" }).click();
await page.waitForTimeout(400);
await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.fill("#firstName", "Ray");
await page.fill("#lastName", "Ortega");
await page.fill("#email", "ray.ortega@example.com");
await page.fill("#cardNumber", "4111111111111111");
await page.fill("#cardMonth", "12");
await page.fill("#cardYear", "2029");
await page.fill("#cardCode", "123");
await page.fill("#cardZip", "79901");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: /Pay \$/ }).click();
try { await page.waitForURL(/confirmation/, { timeout: 20000 }); } catch { console.log("NO NAV. url=", page.url()); console.log((await page.locator("body").innerText()).slice(0,1500)); process.exit(9); }
await page.waitForTimeout(600);

const afterRifle = await dump();
const rifle = afterRifle.items.find((i) => i.slug === "sig-mpx-carbon");
check("a firearm still reserves rather than selling outright",
  rifle?.status === "reserved", `got ${rifle?.status}`);
const rifleLine = afterRifle.order_items[0];
check("a firearm line carries no size", rifleLine?.size == null, `got ${rifleLine?.size}`);
check("a firearm line carries no variant", rifleLine?.variant_id == null);
check("no size checkout did not ask for shipping",
  afterRifle.orders[0]?.has_shipment === false);

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
