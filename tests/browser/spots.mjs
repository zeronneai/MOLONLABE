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
// The board is gone. The count IS the public view of the game now, so
// the assertion is that there is no per-spot rendering at all.
check("there is no board on the page",
  (await page.locator("#board-heading").count()) === 0);

// ------------------------------------------------------- buy three
async function buySpots(qty, { acceptTerms = true } = {}) {
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
  return boxes;
}

{
  const boxes = await buySpots(3, { acceptTerms: false });
  // Two, not three. The board opt-in was the third and is gone with the
  // board — there is no longer anywhere a buyer's name could appear, so
  // there is nothing to ask them about.
  check("there are two checkboxes: sale terms and game terms",
    (await boxes.count()) === 2, String(await boxes.count()));
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

const receipt = await page.locator("body").innerText();
check("the receipt names the spot numbers", has(receipt, "1, 2, 3"));
check("the receipt states there is no end date", has(receipt, "no end date"));

// ----------------------------- the page shows a count and nothing else
//
// The board and every name on it were removed. What is asserted here is
// absence, and it is asserted against the MARKUP as well as the rendered
// text: a name that never reaches the page cannot leak from it, and the
// two failures that matter — a grid coming back, and a buyer's name
// appearing anywhere — both look like nothing at all on screen.
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
text = await page.locator("body").innerText();
const html = await page.content();

check("the scoreboard moved", /2\s*\/\s*5/.test(text.replace(/\s+/g, " ")),
  (text.match(/\d+\s*\/\s*\d+/) ?? ["none"])[0]);
check("there is no board section at all",
  (await page.locator('section[aria-labelledby="board-heading"]').count()) === 0);
check("and no per-spot grid anywhere on the page",
  (await page.locator("li").filter({ hasText: /^Taken$/ }).count()) === 0);

// The buyer's own details, from an order that just completed.
for (const secret of ["Dana", "Ruiz", "dana.ruiz@example.com"]) {
  check(`"${secret}" appears nowhere in the rendered text`, !has(text, secret));
  check(`"${secret}" appears nowhere in the markup either`,
    !html.includes(secret));
}

// There is no opt-in to tick, so nobody can put a name up by accident.
await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const checkoutText = await page.locator("body").innerText();
check("checkout offers no show-my-name opt-in",
  !/show my (first )?name|on the spot board|spot board/i.test(checkoutText),
  (checkoutText.match(/[^\n]*name on[^\n]*/i) ?? ["none offered"])[0].slice(0, 60));
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });

// A fourth spot, so the count below still reaches the pool size. This
// used to be the "opt-in puts a name up" purchase; the opt-in is gone
// but the sale it made is still needed to fill the game.
{
  await buySpots(1, {});
  await page.getByRole("button", { name: /Pay \$/ }).click();
  await page.waitForURL(/confirmation/, { timeout: 25000 });
  await page.waitForTimeout(600);
}
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
const afterFour = await page.locator("body").innerText();
check("four sold, and still no name anywhere",
  !has(afterFour, "Dana") && !has(afterFour, "Ruiz"),
  (afterFour.match(/Dana[^\n]*/) ?? ["clean"])[0].slice(0, 40));

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
