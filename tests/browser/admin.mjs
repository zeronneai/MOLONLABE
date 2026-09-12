// Authorship stamping and the activity log, driven through the real
// admin UI with a real signed-in session.
//
// The double now issues a session for any password, carrying a name in
// user_metadata and an email that is deliberately different from it —
// so "shows the name, never the mailbox" is a thing this can actually
// prove rather than assert.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const SHIRT = "33333333-3333-4333-8333-333333333333";
const NAME = "Rey Marquez";
const EMAIL = "owner@molonlabe.example";

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());
const dump = async () => (await fetch(`${DOUBLE}/__dump`)).json();
const activity = async () => (await dump()).admin_activity;

await fetch(`${DOUBLE}/__reset`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
await ctx.addInitScript(() => window.localStorage.setItem("mlf_age_ok", "1"));
const page = await ctx.newPage();
page.on("pageerror", (e) => bad.push(`PAGE ERROR ${e.message}`));

// Every page the admin renders, so the email check below covers the lot.
const seen = [];
const visit = async (path) => {
  await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const text = await page.locator("body").innerText();
  seen.push([path, text]);
  return text;
};

// ------------------------------------------------------------- sign in
await page.goto(`${APP}/admin`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', "whatever");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
const landed = await page.locator("body").innerText();
check("the owner can sign in", !has(landed, "sign in") || has(landed, "inventory"),
  landed.slice(0, 80).replace(/\n/g, " "));

// ------------------------------------------ the edit screen shows names
const before = (await dump()).items.find((r) => r.id === SHIRT);
check("the seed item has no authorship yet", before.updated_by_name === null);

let text = await visit(`/admin/inventory/${SHIRT}`);
check("an untouched item says so rather than naming nobody",
  has(text, "before this was tracked"));

// ------------------------------- a price change is stamped and logged
await page.fill("#f-price-cents", "41.00");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

let row = (await dump()).items.find((r) => r.id === SHIRT);
check("the edit stamped the editor's name", row.updated_by_name === NAME, row.updated_by_name);
check("the price actually changed", row.price_cents === 4100, String(row.price_cents));

let log = await activity();
const priced = log.find((r) => r.action === "price");
check("the price change was logged", Boolean(priced));
check("the log names the person", priced?.actor_name === NAME, priced?.actor_name);
check("the log keeps what the price was", priced?.before_value === 3200, String(priced?.before_value));
check("the log keeps what it became", priced?.after_value === 4100, String(priced?.after_value));
check("the log identifies the record", priced?.entity_id === SHIRT && has(priced?.entity_label, "tee"));
check("the log never stores the email", !JSON.stringify(log).includes(EMAIL));

// -------------------------------- authorship is not settable by a form
// Smuggle the fields into the submitted form the way a tampered client
// would. The server must ignore them.
await visit(`/admin/inventory/${SHIRT}`);
await page.evaluate(() => {
  const form = document.querySelector("form");
  for (const [k, v] of [
    ["created_by_name", "Somebody Else"],
    ["updated_by_name", "Somebody Else"],
    ["created_by", "00000000-0000-4000-8000-000000000000"],
    ["actor_name", "Somebody Else"],
  ]) {
    const el = document.createElement("input");
    el.type = "hidden";
    el.name = k;
    el.value = v;
    form.appendChild(el);
  }
});
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
row = (await dump()).items.find((r) => r.id === SHIRT);
check("a forged author in the form is ignored",
  row.updated_by_name === NAME && row.created_by_name !== "Somebody Else",
  `${row.created_by_name} / ${row.updated_by_name}`);
check("a forged author never reaches the log",
  !JSON.stringify(await activity()).includes("Somebody Else"));

// --------------------------------------------- archiving is recorded
await visit("/admin/inventory");
const archive = page.locator('button:has-text("Archive")').first();
if (await archive.count()) {
  await archive.click();
  await page.waitForTimeout(2000);
}
log = await activity();
check("archiving is recorded", log.some((r) => r.action === "archive"));

// ------------------------------------------ the offer toggle is recorded
text = await visit("/admin/game");
const toggle = page.locator('button:has-text("Switch"), button:has-text("Turn")').first();
if (await toggle.count()) {
  await toggle.click();
  await page.waitForTimeout(2000);
}
log = await activity();
const offer = log.find((r) => r.action === "offer");
check("switching the discount is recorded", Boolean(offer), offer?.field);
check("the discount log keeps the previous state",
  offer ? offer.before_value !== offer.after_value : false,
  `${offer?.before_value} → ${offer?.after_value}`);

// ---------------------------------------------- tax and postage screen
text = await visit("/admin/commerce");
check("the postage amounts are flagged as placeholders",
  has(text, "placeholder") && has(text, "stand-in"));
check("the tax rate shows 8.25", has(await page.inputValue("#tax"), "8.25"));
await page.fill("#standard", "12.50");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

const commerce = (await dump()).settings.find((r) => r.key === "commerce");
check("postage saved as cents", commerce.value.shipping_standard_cents === 1250,
  String(commerce.value.shipping_standard_cents));
check("the settings row records who changed it", commerce.updated_by_name === NAME,
  commerce.updated_by_name);
const money = (await activity()).find((r) => r.action === "commerce");
check("the postage change is logged with its old value",
  money?.before_value === 1000 && money?.after_value === 1250,
  `${money?.before_value} → ${money?.after_value}`);

// ------------------------------------------------- the activity screen
text = await visit("/admin/activity");
check("the activity screen names the person", has(text, NAME));
check("the activity screen reads as English, not as cents",
  has(text, "repriced") && has(text, "$32.00") && has(text, "$41.00"));

// ------------------------------------- the email appears on no screen
const leaked = seen.filter(([, t]) => has(t, EMAIL)).map(([p]) => p);
check("no admin screen shows the email address", leaked.length === 0, leaked.join(", "));
const html = await page.content();
check("the email is not hiding in the markup either", !html.includes(EMAIL));

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
