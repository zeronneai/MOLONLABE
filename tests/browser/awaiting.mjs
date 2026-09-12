// A game that sold out and has not been drawn.
//
// It is its own state, not a flavour of "open". A full pool listed under
// "Open now" wastes the visit of somebody who arrived ready to buy, and
// hiding it throws away the best evidence on the site that these games
// actually fill. So it stays visible and carries no way to buy.
//
// The assertions below are mostly about ABSENCE, which is the harder
// thing to test and the whole point of the change: a disabled button
// would satisfy "you cannot buy" while still reading as something to
// tap at. So the buy control must not be in the DOM at all — disabled
// or otherwise — and that is checked by looking for the control rather
// than by looking at whether it is clickable.

import { chromium } from "playwright";
import { APP, CHROMIUM } from "../lib/config.mjs";
import {
  suite, reset, insert, insertReturning, update,
  page as newPage,
} from "../lib/harness.mjs";

const { check, note, report } = suite();

const GAME = "55555555-5555-4555-8555-555555555555"; // seeded, 5 spots
const TOTAL = 5;

await reset();

// Sell every spot, and set the status the way the database does when the
// last one goes.
const order = await insertReturning("orders", {
  order_number: "MLF-AWAIT1",
  confirmation_token: "t",
});
for (let n = 1; n <= TOTAL; n++) {
  await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.${n}`, {
    status: "sold",
    order_id: order.id,
    first_name: "Alma",
    last_name: "Castillo",
    email: "alma@example.com",
    show_name: true,
    sold_at: new Date().toISOString(),
  });
}
await update("games", `id=eq.${GAME}`, { status: "full" });

const browser = await chromium.launch({ executablePath: CHROMIUM });

// -------------------------------------------------------- the games list
{
  const page = await newPage(browser);
  await page.goto(`${APP}/games`, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();

  check("GAMES: the full game is still on the page",
    /sold out|awaiting the draw/i.test(text),
    (text.match(/[^\n]*awaiting[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 60));
  check("GAMES: there is an 'awaiting the draw' section",
    /awaiting the draw/i.test(text));
  check("GAMES: it still shows the count, which is the evidence",
    new RegExp(`${TOTAL}\\s*/\\s*${TOTAL}`).test(text),
    (text.match(/\d+\s*\/\s*\d+/g) ?? ["none"]).join(", "));

  // The absence that matters. Not "disabled" — absent.
  const takeSpot = page.getByRole("link", { name: /take a spot/i });
  check("GAMES: no 'take a spot' control exists anywhere on the page",
    (await takeSpot.count()) === 0,
    `${await takeSpot.count()} found`);
  const anyBuy = page.getByRole("button", { name: /add to cart|take a spot|buy/i });
  check("GAMES: and no buy button either, disabled or not",
    (await anyBuy.count()) === 0, `${await anyBuy.count()} found`);

  // A disabled control would be the wrong fix, so prove there isn't one
  // hiding as a disabled element rather than as a missing one.
  const disabled = await page.locator("[disabled], [aria-disabled=true]").count();
  check("GAMES: nothing is present-but-disabled in its place",
    disabled === 0, `${disabled} disabled elements`);

  check("GAMES: the section does not claim the game is open",
    !/open now/i.test(
      text.slice(text.search(/awaiting the draw/i)),
    ),
    "checked the text from the awaiting heading onwards");

  await page.context().close();
}

// --------------------------------------------------------- the home page
{
  const page = await newPage(browser);
  await page.goto(`${APP}/`, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();

  check("HOME: the game section says it is awaiting the draw",
    /awaiting the draw/i.test(text),
    (text.match(/[^\n]*awaiting[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 60));
  check("HOME: it does NOT say 'open game'", !/open game/i.test(text));
  const take = page.getByRole("link", { name: /^take a spot/i });
  check("HOME: the primary buy control is gone",
    (await take.count()) === 0, `${await take.count()} found`);
  check("HOME: a way through to the board remains",
    (await page.getByRole("link", { name: /see the board/i }).count()) > 0);

  await page.context().close();
}

// ------------------------------------------------- the game page itself
{
  const page = await newPage(browser);
  await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  check("FEATURED: says sold out", /sold out/i.test(text));
  check("FEATURED: has no quantity control",
    (await page.locator("#spot-count").count()) === 0);
  check("FEATURED: has no add-to-cart control",
    (await page.getByRole("button", { name: /add|take a spot/i }).count()) === 0);
  await page.context().close();
}

// ------------------------------- contrast: an open game DOES sell spots
// Without this the suite would pass if the buy control disappeared
// everywhere, which is a different bug and a worse one.
{
  await reset();
  const page = await newPage(browser);
  await page.goto(`${APP}/games`, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  check("CONTRAST: an open game is listed as open", /open now/i.test(text));
  check("CONTRAST: and DOES carry a buy control",
    (await page.getByRole("link", { name: /take a spot/i }).count()) > 0);
  check("CONTRAST: and no awaiting section is shown",
    !/awaiting the draw/i.test(text));
  note("the buy control is present when it should be, so its absence above means something");
  await page.context().close();
}

await browser.close();
report();
