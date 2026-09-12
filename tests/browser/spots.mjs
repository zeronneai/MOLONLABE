// Buying spots, through the real UI.
//
// The SQL race is proved separately in race.mjs against real PostgreSQL —
// this double is single-threaded and could not fail it. What this covers
// is everything above the function: pricing, tax, the blocking terms
// checkbox, the opt-in, what lands on the order, and what the board shows.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const GAME = "55555555-5555-4555-8555-555555555555";
const PATCH = "44444444-4444-4444-8444-444444444444";

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());
const dump = async () => (await fetch(`${DOUBLE}/__dump`)).json();

await fetch(`${DOUBLE}/__reset`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
await ctx.addInitScript(() => {
  window.Accept = {
    dispatchData: (d, h) =>
      h({
        messages: { resultCode: "Ok", message: [] },
        opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "NONCE-OK" },
      }),
  };
  localStorage.setItem("mlf_age_ok", "1");
});
const page = await ctx.newPage();
page.on("pageerror", (e) => bad.push(`PAGE ERROR ${e.message}`));

// ------------------------------------------------- the scoreboard
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
let text = await page.locator("body").innerText();
check("the spots-left count is on the page", has(text, "Spots left"));
check("it reads as a scoreboard, out of the total", /5\s*\/\s*5/.test(text.replace(/\s+/g, " ")),
  (text.match(/\d+\s*\/\s*\d+/) ?? ["none"])[0]);
check("the price per spot is shown", has(text, "$30.00"));
check("the terms sit next to the buy control, not only in the rules",
  has(text, "runs until all spots are sold") &&
  has(text, "There is no end date") &&
  has(text, "purchases are final"));
check("the board renders a cell per spot",
  (await page.locator("#board-heading").count()) === 1);
// The legend says "5 open · 0 taken", so assert on the cells rather than
// the page text.
check("every spot starts open",
  (await page.locator('section[aria-labelledby="board-heading"] ul li').count()) === 5 &&
  (await page.locator('section[aria-labelledby="board-heading"] ul li', { hasText: /^\d+Taken$/ }).count()) === 0,
  `${await page.locator('section[aria-labelledby="board-heading"] ul li').count()} cells`);

// ------------------------------------------------------- buy three
async function buySpots(qty, { optIn = false, acceptTerms = true } = {}) {
  await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
  await page.fill("#spot-count", String(qty));
  await page.getByRole("button", { name: /^Take/ }).click();
  await page.waitForTimeout(500);
  await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
  for (const [k, v] of [
    ["#firstName", "Dana"], ["#lastName", "Ruiz"], ["#email", "dana.ruiz@example.com"],
    ["#cardNumber", "4111111111111111"], ["#cardMonth", "12"], ["#cardYear", "2029"],
    ["#cardCode", "123"], ["#cardZip", "79901"],
  ]) if (await page.locator(k).count()) await page.fill(k, v);
  const boxes = page.getByRole("checkbox");
  await boxes.nth(0).check();
  if (acceptTerms) await boxes.nth(1).check();
  if (optIn) await boxes.nth(2).check();
  return boxes;
}

{
  const boxes = await buySpots(3, { acceptTerms: false });
  check("there are three checkboxes: sale terms, game terms, board opt-in",
    (await boxes.count()) === 3, String(await boxes.count()));
  check("the board opt-in starts unchecked", !(await boxes.nth(2).isChecked()));
  check("the game terms start unchecked", !(await boxes.nth(1).isChecked()));
  const pay = page.getByRole("button", { name: /Pay \$/ });
  check("payment is blocked until the game terms are accepted",
    await pay.isDisabled());

  const summary = await page.locator("body").innerText();
  check("checkout prices three spots", has(summary, "3 spots"));
  // 3 × $30 = $90, tax 8.25% = $7.43, total $97.43. No postage: a spot
  // is neither shipped nor collected.
  check("tax is charged on spots", has(summary, "$7.43"), (summary.match(/\$7\.\d\d/) ?? [""])[0]);
  check("no postage on a spot-only order", !has(summary, "Shipping"));
  check("the total is right", has(summary, "$97.43"));

  await page.getByRole("checkbox").nth(1).check();
  check("accepting them unblocks payment", await pay.isEnabled());
  await pay.click();
  try {
    await page.waitForURL(/confirmation/, { timeout: 25000 });
  } catch {
    console.log("NO NAV:", page.url());
    { const t = await page.locator("body").innerText(); const i = t.indexOf("TERMS OF THIS GAME"); console.log("MIDDLE:", t.slice(i, i + 900)); }
    process.exit(9);
  }
  await page.waitForTimeout(800);
}

const d1 = await dump();
const order1 = d1.orders[0];
const sold1 = d1.game_spots.filter((s) => s.status === "sold");
check("three spots were sold", sold1.length === 3, String(sold1.length));
check("they are the first three, in order",
  sold1.map((s) => s.spot_number).join(",") === "1,2,3",
  sold1.map((s) => s.spot_number).join(","));
check("the order records which game", order1?.game_id === GAME);
check("the game terms are stored with a timestamp",
  Boolean(order1?.game_terms_accepted_at) && has(order1?.game_terms_text, "no end date"));
check("the spot numbers are on the order line",
  (d1.order_items[0]?.spot_numbers ?? []).join(",") === "1,2,3",
  String(d1.order_items[0]?.spot_numbers));
check("the line is typed as a game spot", d1.order_items[0]?.line_type === "game_spot");
check("a spot is neither shipped nor collected",
  d1.order_items[0]?.fulfillment_type === "none", d1.order_items[0]?.fulfillment_type);
check("the buyer did not opt in, so show_name is false",
  sold1.every((s) => s.show_name === false));

const receipt = await page.locator("body").innerText();
check("the receipt names the spot numbers", has(receipt, "1, 2, 3"));
check("the receipt states there is no end date", has(receipt, "no end date"));

// --------------------------------------- the board hides the names
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
text = await page.locator("body").innerText();
check("the scoreboard moved", /2\s*\/\s*5/.test(text.replace(/\s+/g, " ")),
  (text.match(/\d+\s*\/\s*\d+/) ?? ["none"])[0]);
check("sold spots read as taken on the board",
  (await page.locator('section[aria-labelledby="board-heading"] ul li').filter({ hasText: "Taken" }).count()) === 3,
  `${await page.locator('section[aria-labelledby="board-heading"] ul li').filter({ hasText: "Taken" }).count()} taken cells`);
check("an opted-out buyer's name is nowhere on the page",
  !has(text, "Dana") && !has(text, "Ruiz"));
const boardHtml = await page.content();
check("and not in the markup either",
  !boardHtml.includes("dana.ruiz@example.com") && !boardHtml.includes("Ruiz"));

// --------------------------------- the opt-in puts a name up
{
  await buySpots(1, { optIn: true });
  await page.getByRole("button", { name: /Pay \$/ }).click();
  await page.waitForURL(/confirmation/, { timeout: 25000 });
  await page.waitForTimeout(600);
}
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
text = await page.locator("body").innerText();
check("an opted-in buyer shows first name and last initial",
  has(text, "Dana R."), (text.match(/Dana[^\n]*/) ?? ["absent"])[0]);
check("even opted in, the surname is never shown in full",
  !(await page.content()).includes("Dana Ruiz"));
check("and the email is still nowhere",
  !(await page.content()).includes("dana.ruiz@example.com"));

// ------------------------------------- selling the last spot closes it
{
  await buySpots(1, {});
  await page.getByRole("button", { name: /Pay \$/ }).click();
  await page.waitForURL(/confirmation/, { timeout: 25000 });
  await page.waitForTimeout(800);
}
const d2 = await dump();
check("the game is now full", d2.games[0].status === "full", d2.games[0].status);
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
text = await page.locator("body").innerText();
check("the page says sold out", has(text, "SOLD OUT"));
check("and stops offering spots", !has(text, "How many spots"));
check("the owner is told the game filled",
  d2.notifications.some((n) => n.kind === "game_full"),
  d2.notifications.map((n) => n.kind).join(", "));
const full = d2.notifications.find((n) => n.kind === "game_full");
check("the sold-out notice says what to do next",
  has(full?.summary, "Nothing else happens until you draw"));

// ------------------------- a sold-out game refuses a further purchase
await page.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
await page.evaluate(
  (g) => localStorage.setItem("mlf_cart", JSON.stringify([{ gameId: g, quantity: 1 }])),
  GAME,
);
await page.goto(`${APP}/cart`, { waitUntil: "networkidle" });
text = await page.locator("body").innerText();
check("a cart holding a spot in a sold-out game says so",
  has(text, "sold out"), text.slice(0, 120).replace(/\n/g, " "));

// ----------------- ordinary merchandise earns nothing at all any more
await page.evaluate(
  (id) => localStorage.setItem("mlf_cart", JSON.stringify([{ itemId: id, quantity: 1 }])),
  PATCH,
);
await page.goto(`${APP}/cart`, { waitUntil: "networkidle" });
text = await page.locator("body").innerText();
check("a plain purchase says nothing about entries or spots",
  !has(text, "entries") && !has(text, "earns"), text.match(/earn[^\n]*/)?.[0] ?? "clean");
await page.goto(`${APP}/inventory/skull-patch`, { waitUntil: "networkidle" });
check("nor does a product page",
  !has(await page.locator("body").innerText(), "entries"));

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
