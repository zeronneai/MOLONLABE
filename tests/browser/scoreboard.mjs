// The number on the page, on every page that shows it.
//
// A game with sold spots displaying zero sold spots is what a lifecycle
// test should fail on, and no test failed: the suite asserted heavily on
// DATA — what landed in the winners row, what the draw recorded — and on
// rendered output only where the rendering was the feature. The count
// was treated as arithmetic over data already checked, so nobody checked
// the arithmetic reached the screen.
//
// The one assertion that touched it accepted anything:
//
//   check("HOME: the past games section is honest about being empty",
//     /no game has been drawn yet/i.test(home) || /\d+\s*\/\s*\d+/.test(home));
//
// "0 / 5" matches `\d+\s*\/\s*\d+`. The test passed on the bug it was
// closest to catching. That is the worse half of this: not an untested
// path, a test that looked like coverage.
//
// So this asserts the VALUE, on every surface that renders it, against a
// game whose sold count is a number no accident produces — not 0, not 1,
// not the total, and not a number that appears elsewhere on the page.

import { chromium } from "playwright";
import { APP, CHROMIUM } from "../lib/config.mjs";
import {
  suite, reset, insert, insertReturning, update, dump,
  page as newPage, adminPage,
} from "../lib/harness.mjs";

const { check, note, report } = suite();

const GAME = "55555555-5555-4555-8555-555555555555";
const DRAWN = "66666666-6666-4666-8666-666666666666";
const RIFLE = "11111111-1111-4111-8111-111111111111";

// 7 of 12 on a game that is finished. Seven is not zero, not one, not
// the total, and not the spot count of the seeded game — so a wrong
// number cannot coincidentally read as the right one.
const TOTAL = 12;
const SOLD = 7;

await reset();

await insert("games", {
  id: DRAWN,
  title: "Finished Game",
  total_spots: TOTAL,
  spot_price_cents: 2500,
  status: "drawn",
  item_id: RIFLE,
});
const order = await insertReturning("orders", {
  order_number: "MLF-SCORE1",
  confirmation_token: "t",
});
for (let n = 1; n <= TOTAL; n++) {
  await insert("game_spots", {
    game_id: DRAWN,
    spot_number: n,
    status: n <= SOLD ? "sold" : "open",
    order_id: n <= SOLD ? order.id : null,
    first_name: n <= SOLD ? "Alma" : null,
    last_name: n <= SOLD ? "Castillo" : null,
    email: n <= SOLD ? "alma@example.com" : null,
    sold_at: n <= SOLD ? new Date().toISOString() : null,
  });
}
await insert("winners", {
  game_id: DRAWN,
  display_name: "Alma C.",
  seed: "scoreboard-seed",
  ticket: 4,
  ticket_index: 4,
  entry_total: SOLD,
  drawn_early: true,
  unsold_spots: TOTAL - SOLD,
  drawn_at: new Date().toISOString(),
});

const seen = (text) => {
  // Every "N / M" pair on the page, so the assertion can say what it
  // actually found rather than just that it did not find the right one.
  const pairs = [...text.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((m) => `${m[1]}/${m[2]}`);
  return pairs.length ? pairs.join(", ") : "no N/M pair on the page";
};
const showsCount = (text, sold = SOLD, total = TOTAL) =>
  new RegExp(`\\b${sold}\\s*/\\s*${total}\\b`).test(text) ||
  new RegExp(`\\b${sold}\\b[^\\n]{0,24}\\bof\\b[^\\n]{0,4}\\b${total}\\b`, "i").test(text) ||
  new RegExp(`\\b${sold}\\s*spots?\\s*sold`, "i").test(text);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await newPage(browser);

// ------------------------------------------------------------ home page
await page.goto(`${APP}/`, { waitUntil: "networkidle" });
const home = await page.locator("body").innerText();

check("HOME: a drawn game shows the spots that actually sold",
  showsCount(home), seen(home));
check("HOME: and does NOT show zero sold",
  !new RegExp(`\\b0\\s*/\\s*${TOTAL}\\b`).test(home), seen(home));
check("HOME: names the winner of the drawn game",
  /alma c\./i.test(home));

// ---------------------------------------------------------- games list
await page.goto(`${APP}/games`, { waitUntil: "networkidle" });
const games = await page.locator("body").innerText();

check("GAMES: a drawn game shows the spots that actually sold",
  showsCount(games), seen(games));
check("GAMES: and does NOT show zero sold",
  !new RegExp(`\\b0\\s*/\\s*${TOTAL}\\b`).test(games), seen(games));

// --------------------------------------------------------- game detail
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
const featured = await page.locator("body").innerText();
const liveSold = (await dump()).game_spots.filter(
  (s) => s.game_id === GAME && s.status === "sold",
).length;
check("FEATURED: the live game's scoreboard agrees with its spots",
  new RegExp(`\\b${liveSold}\\b`).test(featured),
  `${liveSold} sold — ${seen(featured)}`);

await page.context().close();

// --------------------------------------------------------------- admin
{
  const admin = await adminPage(browser);
  await admin.goto(`${APP}/admin/inventory`, { waitUntil: "networkidle" });
  const inv = await admin.locator("body").innerText();
  check("ADMIN inventory: the drawn game shows its real sold count",
    showsCount(inv), seen(inv));

  await admin.goto(`${APP}/admin/games`, { waitUntil: "networkidle" });
  const list = await admin.locator("body").innerText();
  check("ADMIN games: the drawn game shows its real sold count",
    showsCount(list), seen(list));
  await admin.context().close();
}

// ------------------------------------------------- the count is frozen
// The reason a finished game reads from the winners row rather than
// recounting: what was true at the draw stays true afterwards. A spot
// refunded next month must not quietly change the number that was said
// on camera.
await update("game_spots", `game_id=eq.${DRAWN}&spot_number=eq.1`, {
  status: "open", order_id: null, first_name: null, last_name: null,
  email: null, sold_at: null,
});

const after = await newPage(browser);
await after.goto(`${APP}/games`, { waitUntil: "networkidle" });
const refunded = await after.locator("body").innerText();
check("a spot released after the draw does NOT move the drawn count",
  showsCount(refunded),
  `expected ${SOLD}/${TOTAL} still — ${seen(refunded)}`);
note(`${SOLD - 1} spots are sold now; the page still reports the ${SOLD} it was drawn on`);
await after.context().close();

// ------------------------------- a live game is NOT frozen, by contrast
// The freeze applies to a finished game and nothing else. A game still
// selling has to move, or the scoreboard stops being a scoreboard.
{
  const o = await insertReturning("orders", {
    order_number: "MLF-SCORE2", confirmation_token: "t",
  });
  await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.1`, {
    status: "sold", order_id: o.id, first_name: "Ray", last_name: "Ortega",
    email: "ray@example.com",
    sold_at: new Date().toISOString(),
  });
  const live = await newPage(browser);
  await live.goto(`${APP}/games`, { waitUntil: "networkidle" });
  const text = await live.locator("body").innerText();
  const nowSold = (await dump()).game_spots.filter(
    (s) => s.game_id === GAME && s.status === "sold",
  ).length;
  check("a live game's count DOES move when a spot sells",
    new RegExp(`\\b${nowSold}\\s*/\\s*5\\b`).test(text),
    `${nowSold} sold — ${seen(text)}`);
  await live.context().close();
}

await browser.close();
report();
