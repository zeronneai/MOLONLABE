// What a customer sees when there is nothing to show.
//
// An empty state is written when the shop is empty, which is when the
// person writing it is thinking about the owner setting it up. "This
// section fills itself. Nothing needs doing." shipped on the public home
// page for exactly that reason: it answered the owner's question on a
// page only customers read. Every public empty state is rendered here,
// with the catalogue, the drops and the cart all emptied, and read for
// words that are addressed to the person running the shop rather than
// the person visiting it. And for em dashes, which the client does not
// want in the copy.

import { APP, DOUBLE } from "../lib/config.mjs";
import { browser, page as newPage, reset, suite } from "../lib/harness.mjs";

const { check, report } = suite();

/** Phrases that are about running the shop, not about shopping in it. */
const OWNER_VOICE =
  /nothing needs doing|fills itself|priced for sale|as it goes up|in the admin|the owner|set a price|add (an|the) item|once you|you create|your stock/i;

await reset();
for (const table of ["winners", "game_spots", "games", "item_variants", "items"]) {
  await fetch(`${DOUBLE}/rest/v1/${table}`, { method: "DELETE" });
}
const left = await (await fetch(`${DOUBLE}/__dump`)).json();
check("the site really is empty for this test",
  left.items.length === 0 && left.games.length === 0,
  `${left.items.length} items, ${left.games.length} drops`);

const b = await browser();
const p = await newPage(b, { viewport: { width: 1280, height: 1200 } });

const PAGES = ["/", "/shop", "/in-the-case", "/games", "/featured", "/cart"];
for (const path of PAGES) {
  await p.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(300);
  // Only the empty states themselves. The page around them is ordinary
  // copy, and the em dash instruction was about these.
  const blocks = await p.locator("[data-empty-state]").allInnerTexts();
  check(`${path} empty: shows an empty state at all`, blocks.length > 0, `${blocks.length}`);
  const text = blocks.join("\n");
  const owner = text.match(new RegExp(`[^.]*(${OWNER_VOICE.source})[^.]*`, "i"));
  check(`${path} empty: written for a customer, not the owner`, !owner,
    owner ? owner[0].trim().slice(0, 90) : "clean");
  const dash = text.match(/.{0,40}—.{0,40}/);
  check(`${path} empty: no em dash`, !dash, dash ? dash[0] : "clean");
}

// The one that started this.
await p.goto(`${APP}/`, { waitUntil: "networkidle" });
const home = await p.locator("main").innerText();
check("HOME: the past drops empty state tells a buyer what will appear there",
  /winners are shown by first name and last initial/i.test(home),
  (home.match(/[^\n]*drawn yet[^\n]*/i) ?? ["NOT FOUND"])[0].slice(0, 90));

await b.close();
report();
