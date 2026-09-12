// Taking spots, then taking more of the same game, then paying.
//
// Every assertion here is the state after a purchase that went through
// the real control, the real cart and the real checkout. Three things
// this suite exists to stop coming back:
//
//   1. The SILENT REPLACE. Adding 2 and then 3 used to leave 3 in the
//      cart, not 5. The control said "Take 3 spots" and quietly removed
//      the two already there. It looked like it worked, which is the
//      worst way for a buy control to fail.
//
//   2. THE INVENTED CAP. 25 spots an order, decided by nobody, written
//      into the official rules as policy, and turning away the person
//      who wants forty — the best customer a game like this has.
//
//   3. SCARCITY FOUND AT CHECKOUT. How many are left is said next to the
//      control, before anyone dials a number they cannot have.

import { chromium } from "playwright";
import { APP, CHROMIUM } from "../lib/config.mjs";
import {
  suite, reset, dump, insert, update, page as newPage, acceptStub,
} from "../lib/harness.mjs";

const { check, note, report } = suite();

const SMALL = "55555555-5555-4555-8555-555555555555"; // seeded, 5 spots
const BIG = "77777777-7777-4777-8777-777777777777";
const BIG_SPOTS = 60; // comfortably over the cap that used to exist
const RIFLE = "11111111-1111-4111-8111-111111111111";

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function shopper() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(acceptStub(0), 0);
  await ctx.addInitScript(() => {
    localStorage.setItem("mlf_age_ok", "1");
    localStorage.setItem("mlf_intro_seen", "1");
  });
  return ctx.newPage();
}

/**
 * Drives the + button from 1 towards n, and STOPS when the control
 * refuses to go further.
 *
 * Typing into the field looks simpler and is not: it clamps to a minimum
 * of 1, so clearing it and typing "2" leaves "12". That produced a false
 * pass once already — a test that believed it was buying two spots while
 * buying five. The buttons move one at a time and cannot be misread.
 */
async function setQty(page, n) {
  const plus = page.getByRole("button", { name: /one more/i });
  for (let i = 1; i < n; i++) {
    if (await plus.isDisabled()) break;
    await plus.click();
    await page.waitForTimeout(25);
  }
  return page.locator("#spot-count").inputValue();
}

async function takeSpots(page, gameUrl, n) {
  await page.goto(gameUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const shown = await setQty(page, n);
  await page.getByRole("button", { name: /^take /i }).click();
  await page.waitForTimeout(500);
  return shown;
}

async function pay(page, who) {
  await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.fill("#firstName", who);
  await page.fill("#lastName", "Castillo");
  await page.fill("#email", `${who.toLowerCase()}@example.com`);
  await page.fill("#cardNumber", "4111111111111111");
  await page.fill("#cardMonth", "12");
  await page.fill("#cardYear", "2029");
  await page.fill("#cardCode", "123");
  await page.fill("#cardZip", "79901");
  for (const cb of await page.getByRole("checkbox").all()) {
    if (await cb.isVisible()) await cb.check().catch(() => {});
  }
  await page.getByRole("button", { name: /Pay \$/ }).click();
  return page
    .waitForURL(/confirmation/, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
}

// =====================================================================
// 1. Add, then add more of the same game. The merge.
// =====================================================================
await reset();
{
  const page = await shopper();

  const first = await takeSpots(page, `${APP}/featured`, 2);
  check("first add asks for 2", first === "2", `control showed ${first}`);
  const afterFirst = await page.locator("body").innerText();
  check("the page says 2 spots are in the cart",
    /\b2 spots in your cart/i.test(afterFirst),
    (afterFirst.match(/[^\n]*in your cart[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 50));

  const second = await takeSpots(page, `${APP}/featured`, 3);
  check("second add asks for 3", second === "3", `control showed ${second}`);
  const afterSecond = await page.locator("body").innerText();
  check("the page now says 5 — the running total, not the 3 just added",
    /\b5 spots in your cart/i.test(afterSecond),
    (afterSecond.match(/[^\n]*in your cart[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 50));

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mlf_cart") || "[]"));
  check("the cart holds one spot line of 5",
    stored.length === 1 && stored[0].quantity === 5, JSON.stringify(stored));

  check("paying completes", await pay(page, "Alma"));

  const d = await dump();
  const sold = d.game_spots.filter((s) => s.game_id === SMALL && s.status === "sold");
  const nums = sold.map((s) => s.spot_number).sort((a, b) => a - b);
  check("2 + 3 really bought five spots", sold.length === 5, `${sold.length}: ${nums.join(",")}`);
  check("one order", new Set(sold.map((s) => s.order_id)).size === 1);
  check("one charge", (d.charges ?? []).length === 1, `${(d.charges ?? []).length}`);
  const lines = d.order_items.filter((l) => l.line_type === "game_spot");
  check("one order line, quantity 5",
    lines.length === 1 && lines[0].quantity === 5,
    `${lines.length} line(s), qty ${lines[0]?.quantity}`);
  note(`merge: bought spots ${nums.join(", ")}`);
  await page.context().close();
}

// =====================================================================
// 2. More than the cap that used to exist.
// =====================================================================
await reset();
// /featured shows the current open game, so the seeded one is put out of
// the way first — otherwise this section silently tests the 5-spot game
// and the cap assertions mean nothing.
await update("games", `id=eq.${SMALL}`, { status: "drawn" });
await insert("games", {
  id: BIG, title: "Big Game", total_spots: BIG_SPOTS,
  spot_price_cents: 1000, status: "open", item_id: RIFLE,
});
for (let n = 1; n <= BIG_SPOTS; n++) {
  await insert("game_spots", { game_id: BIG, spot_number: n, status: "open" });
}
{
  const page = await shopper();
  // /featured shows the newest open game, which is this one.
  await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const title = await page.locator("h1").first().innerText();
  note(`big-game page shows: ${title}`);
  check("the page under test really is the 60-spot game",
    /big game|sig|mpx/i.test(title) &&
      /\b60\b/.test(await page.locator("body").innerText()),
    title);

  await setQty(page, 40);
  const shown = await page.locator("#spot-count").inputValue();
  check("the control allows 40 — more than the old 25 cap",
    shown === "40", `control showed ${shown}`);

  await page.getByRole("button", { name: /^take /i }).click();
  await page.waitForTimeout(600);
  const msg = await page.locator("body").innerText();
  check("it confirms 40 in the cart",
    /\b40 spots in your cart/i.test(msg),
    (msg.match(/[^\n]*in your cart[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 50));

  // And take more on top, over the old cap in a single line.
  await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await setQty(page, 15);
  await page.getByRole("button", { name: /^take /i }).click();
  await page.waitForTimeout(600);
  const msg2 = await page.locator("body").innerText();
  check("40 + 15 confirms 55",
    /\b55 spots in your cart/i.test(msg2),
    (msg2.match(/[^\n]*in your cart[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 50));

  check("paying for 55 spots completes", await pay(page, "Ray"));

  const d = await dump();
  const sold = d.game_spots.filter((s) => s.game_id === BIG && s.status === "sold");
  check("55 spots are sold in ONE order", sold.length === 55, `${sold.length} sold`);
  check("one charge for all 55", (d.charges ?? []).length === 1,
    `${(d.charges ?? []).length}`);
  const line = d.order_items.find((l) => l.line_type === "game_spot");
  check("the order line records 55", line?.quantity === 55, `qty ${line?.quantity}`);
  const nums = sold.map((s) => s.spot_number).sort((a, b) => a - b);
  check("they are the lowest 55 numbers",
    nums[0] === 1 && nums[nums.length - 1] === 55, `${nums[0]}..${nums[nums.length - 1]}`);
  note(`bought 55 of ${BIG_SPOTS} in one transaction, one charge`);
  await page.context().close();
}

// =====================================================================
// 3. Scarcity said at the control, not discovered at checkout.
// =====================================================================
{
  const page = await shopper();
  await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  const left = BIG_SPOTS - 55;
  check(`with ${left} left, the page says so next to the control`,
    new RegExp(`only ${left} spots left`, "i").test(body),
    (body.match(/[^\n]*spots? left[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 60));

  await setQty(page, 99);
  const shown = await page.locator("#spot-count").inputValue();
  check("and the control will not go past what is left",
    Number(shown) === left, `showed ${shown}, ${left} remain`);
  await page.context().close();
}

await browser.close();
report();
