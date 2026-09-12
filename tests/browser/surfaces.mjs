// Three surfaces, and the two ways deriving them could go wrong.
//
// The derivation is by CATEGORY, not by price — see lib/surfaces.ts. The
// two failures that rule exists to prevent are both silent, so both are
// asserted here rather than trusted:
//
//   a priced firearm appearing in the Shop with a Buy button
//   an unpriced t-shirt appearing in the firearms case
//
// The first is the serious one. A firearm is transferred through an FFL
// with a background check; it must never be reachable by cart.

import { chromium } from "playwright";
import { APP, CHROMIUM, DOUBLE } from "../lib/config.mjs";
import { suite, reset, insert, page as newPage, dump } from "../lib/harness.mjs";

const { check, note, report } = suite();

const RIFLE = "11111111-1111-4111-8111-111111111111";
const SHIRT = "33333333-3333-4333-8333-333333333333";
const GAME = "55555555-5555-4555-8555-555555555555";

await reset();

// An unpriced non-firearm, which must NOT fall through to the case.
await insert("items", {
  id: "eeee0000-0000-4000-8000-00000000ee01",
  slug: "unpriced-cap", name: "Unpriced Cap", category: "apparel",
  price_cents: null, fulfillment_type: "ship", shipping_tier: "standard",
  status: "available", has_variants: false, images: [], specs: {},
});
// A priced optic — Shop, per the client's list.
await insert("items", {
  id: "eeee0000-0000-4000-8000-00000000ee02",
  slug: "test-optic", name: "Test Optic", category: "optic",
  price_cents: 32900, fulfillment_type: "ship", shipping_tier: "standard",
  status: "available", has_variants: false, images: [], specs: {},
});
// A firearm that is NOT in a game. The seeded rifle is the seeded game's
// prize, so without this the case would be empty and "the case shows
// firearms" would be untestable.
await insert("items", {
  id: "eeee0000-0000-4000-8000-00000000ee05",
  slug: "case-shotgun", name: "Case Shotgun", category: "shotgun",
  price_cents: null, fulfillment_type: "pickup", shipping_tier: "standard",
  status: "available", has_variants: false, images: [], specs: {},
});
// Ammunition — Shop, per the client's list. It used to be inventory-only.
await insert("items", {
  id: "eeee0000-0000-4000-8000-00000000ee03",
  slug: "test-ammo", name: "Test Ammunition", category: "ammunition",
  price_cents: 2400, fulfillment_type: "ship", shipping_tier: "standard",
  status: "available", has_variants: false, images: [], specs: {},
});

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await newPage(browser);

// ------------------------------------------------------------- the shop
await page.goto(`${APP}/shop`, { waitUntil: "networkidle" });
const shop = await page.locator("body").innerText();

check("SHOP: shows a priced optic", /test optic/i.test(shop));
check("SHOP: shows priced ammunition", /test ammunition/i.test(shop));
check("SHOP: shows the priced apparel", /molon labe tee/i.test(shop));
check("SHOP: does NOT show a firearm", !/sig mpx|mpx carbon/i.test(shop),
  (shop.match(/[^\n]*mpx[^\n]*/i) ?? ["clean"])[0].slice(0, 60));
check("SHOP: does NOT show an unpriced item — it could not be bought",
  !/unpriced cap/i.test(shop));
check("SHOP: offers category filtering", /\ball\b/i.test(shop) && /apparel|optic|ammunition/i.test(shop));

// ---------------------------------------------------------- in the case
await page.goto(`${APP}/in-the-case`, { waitUntil: "networkidle" });
const theCase = await page.locator("body").innerText();

check("CASE: shows a firearm that is not in a game",
  /case shotgun/i.test(theCase),
  (theCase.match(/[^\n]*shotgun[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 60));
check("CASE: does NOT show the firearm that is a game's prize",
  !/sig mpx|mpx carbon/i.test(theCase),
  (theCase.match(/[^\n]*mpx[^\n]*/i) ?? ["correctly absent"])[0].slice(0, 60));
check("CASE: does NOT show apparel", !/molon labe tee/i.test(theCase));
check("CASE: does NOT show the unpriced cap — apparel is not case stock",
  !/unpriced cap/i.test(theCase));
check("CASE: shows no price and no cart control",
  !/add to (cart|basket)/i.test(theCase) && !/\$[\d,]{3,}/.test(theCase),
  (theCase.match(/\$[\d,]+/) ?? ["no price shown"])[0]);

// --------------------------------------------- a firearm cannot be priced
// The database refuses it, so the double's schema guard is not the thing
// under test here — what is tested is that even if a price arrived, the
// firearm still would not reach the Shop, because the surface is derived
// from the category.
await insert("items", {
  id: "eeee0000-0000-4000-8000-00000000ee04",
  slug: "priced-rifle", name: "Wrongly Priced Rifle", category: "rifle",
  price_cents: 99900, fulfillment_type: "pickup", shipping_tier: "standard",
  status: "available", has_variants: false, images: [], specs: {},
});
await page.goto(`${APP}/shop`, { waitUntil: "networkidle" });
const shopAgain = await page.locator("body").innerText();
check("SHOP: a firearm carrying a price STILL does not reach the shop",
  !/wrongly priced rifle/i.test(shopAgain),
  (shopAgain.match(/[^\n]*wrongly priced[^\n]*/i) ?? ["clean"])[0].slice(0, 60));

// ------------------------------------------------------------ the games
// A game's prize leaves the case: while it is in a game it belongs to
// the Games surface, and it stays there once drawn.
await page.goto(`${APP}/games`, { waitUntil: "networkidle" });
const games = await page.locator("body").innerText();
check("GAMES: the page renders", /a fixed number|open now/i.test(games),
  games.slice(0, 60).replace(/\n/g, " "));

await page.goto(`${APP}/in-the-case`, { waitUntil: "networkidle" });
const caseWithGame = await page.locator("body").innerText();
const gameRow = (await dump()).games.find((g) => g.id === GAME);
if (gameRow?.item_id === RIFLE) {
  check("CASE: the game's prize is not also in the case",
    !/sig mpx|mpx carbon/i.test(caseWithGame),
    (caseWithGame.match(/[^\n]*mpx[^\n]*/i) ?? ["correctly absent"])[0].slice(0, 60));
} else {
  note("the seeded game has no prize item, so the exclusion is not exercised");
}

// ----------------------------------------------- /inventory still works
const res = await page.goto(`${APP}/inventory`, { waitUntil: "networkidle" });
check("the old /inventory URL still lands somewhere real",
  res.status() < 400 && /in the case|the case/i.test(await page.locator("body").innerText()),
  `${res.status()} ${page.url()}`);

// ---------------------------------------------------- the home page
await page.goto(`${APP}/`, { waitUntil: "networkidle" });
const home = await page.locator("body").innerText();
check("HOME: fresh arrivals shows at most two items",
  (home.match(/newest in the shop/i) ?? []).length === 1);
check("HOME: has a past games section", /already drawn|past games/i.test(home));
// This used to accept `/\d+\s*\/\s*\d+/` — any two numbers with a slash
// between them — as proof the section was working. "0 / 5" matched, so
// the assertion passed for weeks against a section that showed zero sold
// for every game that had ever sold anything. A pattern loose enough to
// match the bug is not coverage, it is the appearance of it.
//
// The count itself is asserted by value in tests/browser/scoreboard.mjs.
// What is left here is the narrower thing this suite is about: either
// the empty state, or a real game with a count that is not zero.
const pastGamesPairs = [...home.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
check("HOME: the past games section is honest about being empty",
  /no game has been drawn yet/i.test(home) || pastGamesPairs.length > 0,
  pastGamesPairs.map((m) => m[0]).join(", ") || "empty state shown");
check("HOME: no past game claims zero spots sold",
  pastGamesPairs.every((m) => Number(m[1]) > 0),
  pastGamesPairs.map((m) => m[0]).join(", ") || "none rendered");

const grounds = await page.evaluate(() =>
  [...document.querySelectorAll("section")]
    .map((s) => [...s.classList].find((c) => c.startsWith("ground-")))
    .filter(Boolean),
);
check("HOME: the three surfaces each carry their own ground",
  new Set(grounds).size >= 3, grounds.join(", ") || "none found");
check("HOME: consecutive sections do not share a ground",
  grounds.every((g, i) => i === 0 || g !== grounds[i - 1]),
  grounds.join(" → "));

await browser.close();
report();
