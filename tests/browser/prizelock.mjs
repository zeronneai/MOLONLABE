// An item that is the prize in a running game is not for sale.
//
// The failure this prevents: somebody buys the prize outright while
// other people are paying for a chance to win it. That is the worst
// thing this system could do, so the assertions below go after the
// PURCHASE PATH and not just the listings — a grid that hides something
// is cosmetic, and a direct URL walks straight past it.
//
// Second failure, which is how the first was noticed: the item vanished
// from the admin entirely. It was filtered out of both inventory lists
// while the games section listed games rather than items. An item the
// owner cannot see is an item he cannot fix.

import { chromium } from "playwright";
import { APP, CHROMIUM } from "../lib/config.mjs";
import {
  suite, reset, dump, insert, update,
  page as newPage, adminPage, acceptStub,
} from "../lib/harness.mjs";

const { check, note, report } = suite();

const GAME = "55555555-5555-4555-8555-555555555555";
const SHIRT = "33333333-3333-4333-8333-333333333333"; // apparel, priced, in the Shop
const SHIRT_SLUG = "molon-labe-tee";

await reset();
// Make the seeded game's prize the APPAREL item — the case in the report.
// A firearm prize was already excluded from the case; an apparel prize
// was not excluded from the Shop, which is where the hole was.
await update("games", `id=eq.${GAME}`, { item_id: SHIRT });

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

// ------------------------------------------------ it is off the surfaces
{
  const page = await shopper();

  await page.goto(`${APP}/shop`, { waitUntil: "networkidle" });
  check("SHOP: the prize is not listed",
    !/molon labe tee/i.test(await page.locator("body").innerText()));

  await page.goto(`${APP}/`, { waitUntil: "networkidle" });
  const home = await page.locator("body").innerText();
  const fresh = home.slice(0, home.search(/in the case/i) + 1 || undefined);
  check("HOME: fresh arrivals does not offer it either",
    !/molon labe tee/i.test(fresh),
    (fresh.match(/[^\n]*molon labe tee[^\n]*/i) ?? ["absent"])[0].slice(0, 50));

  await page.context().close();
}

// ------------------------------------- the product page sells nothing
{
  const page = await shopper();
  const res = await page.goto(`${APP}/inventory/${SHIRT_SLUG}`, {
    waitUntil: "networkidle",
  });
  const text = await page.locator("body").innerText();

  check("ITEM PAGE: still resolves — an old link should not 404",
    res.status() < 400, String(res.status()));
  check("ITEM PAGE: says it is not for sale", /not for sale/i.test(text));
  check("ITEM PAGE: explains why", /prize in a game/i.test(text));
  check("ITEM PAGE: has NO add-to-cart control",
    (await page.getByRole("button", { name: /add to cart|pick a size/i }).count()) === 0,
    `${await page.getByRole("button", { name: /add to cart|pick a size/i }).count()} found`);
  check("ITEM PAGE: and nothing disabled standing in for one",
    (await page.locator("button[disabled]").count()) === 0);
  await page.context().close();
}

// ------------------------- THE GUARD: a cart forced past the UI is refused
// This is the assertion that matters. The listings are presentation; a
// cart written straight to localStorage is what an actual attempt looks
// like, and the pricer has to be the thing that says no.
{
  const page = await shopper();
  await page.goto(`${APP}/shop`, { waitUntil: "networkidle" });
  await page.evaluate((id) => {
    localStorage.setItem("mlf_cart", JSON.stringify([{ itemId: id, quantity: 1 }]));
  }, SHIRT);

  await page.goto(`${APP}/cart`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const cart = await page.locator("body").innerText();
  check("CART: a hand-written cart holding the prize is refused",
    /not for sale|prize in a game/i.test(cart),
    (cart.match(/[^\n]*(prize|not for sale)[^\n]*/i) ?? ["NOT REFUSED"])[0].slice(0, 70));
  check("CART: it is not priced into a total",
    !/\$32\.00/.test(cart), (cart.match(/\$[\d.]+/g) ?? []).join(" "));

  const before = (await dump()).orders.length;
  await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const checkout = await page.locator("body").innerText();
  const payable = await page.getByRole("button", { name: /Pay \$/ }).count();
  check("CHECKOUT: there is nothing payable",
    payable === 0 || /nothing|empty|not for sale/i.test(checkout),
    `${payable} pay button(s)`);
  check("CHECKOUT: no order was created", (await dump()).orders.length === before);
  await page.context().close();
}

// ------------------------------------ it comes back once the game is drawn
{
  await update("games", `id=eq.${GAME}`, { status: "drawn" });
  const page = await shopper();
  await page.goto(`${APP}/shop`, { waitUntil: "networkidle" });
  check("AFTER THE DRAW: it is back in the Shop",
    /molon labe tee/i.test(await page.locator("body").innerText()));

  await page.goto(`${APP}/inventory/${SHIRT_SLUG}`, { waitUntil: "networkidle" });
  check("AFTER THE DRAW: and can be bought again",
    (await page.getByRole("button", { name: /add to cart|pick a size/i }).count()) > 0);
  note("a drawn game releases its prize — apparel is stock the shop keeps selling");
  await page.context().close();
}

// --------------------------------------------- the owner can always see it
{
  await update("games", `id=eq.${GAME}`, { status: "open" });
  const admin = await adminPage(browser);
  await admin.goto(`${APP}/admin/inventory`, { waitUntil: "networkidle" });
  const text = await admin.locator("body").innerText();

  check("ADMIN: the prize item is visible somewhere on the page",
    /molon labe tee/i.test(text),
    (text.match(/[^\n]*molon labe tee[^\n]*/i) ?? ["MISSING — invisible again"])[0].slice(0, 60));
  check("ADMIN: and is labelled as a prize that cannot be sold",
    /prize · not for sale/i.test(text),
    (text.match(/[^\n]*prize[^\n]*/i) ?? ["NOT LABELLED"])[0].slice(0, 60));
  check("ADMIN: no item is missing from every section",
    !/are not shown in any section/i.test(text),
    (text.match(/[^\n]*not shown in any section[^\n]*/i) ?? ["all accounted for"])[0].slice(0, 70));
  await admin.context().close();
}

await browser.close();
report();
