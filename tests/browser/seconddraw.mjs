// What happens when you draw a game that already has a winner?
//
// The intended answer is: it RETURNS THE EXISTING WINNER and does not
// draw again. Not a refusal — a replay. That is deliberate, because the
// owner has to be able to re-run the presentation after a phone locks
// mid-take without the result changing under him.
//
// Demonstrated rather than asserted, on both routes: the admin page and
// the filmed presentation. The distinction that matters is between "the
// same name came out" and "nothing was drawn at all" — a second draw
// that happened to pick the same spot would look identical on screen and
// be a completely different thing. So this compares the winners ROW —
// its id, seed and spot — before and after.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const GAME = "99999999-9999-4999-8999-999999999999";

const ok = [], bad = [], notes = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const j = { "content-type": "application/json" };
const post = (t, b) =>
  fetch(`${DOUBLE}/rest/v1/${t}`, { method: "POST", headers: j, body: JSON.stringify(b) });
const winners = async () => (await (await fetch(`${DOUBLE}/__dump`)).json()).winners;

await fetch(`${DOUBLE}/__reset`);
await post("games", {
  id: GAME, title: "Second Draw Game", status: "full",
  total_spots: 8, spot_price_cents: 3000,
});
const orderId = (await (await fetch(`${DOUBLE}/rest/v1/orders`, {
  method: "POST", headers: { ...j, prefer: "return=representation" },
  body: JSON.stringify({ order_number: "MLF-SEC001", confirmation_token: "t" }),
})).json())[0].id;
for (let n = 1; n <= 8; n++) {
  await post("game_spots", {
    id: `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`,
    game_id: GAME, spot_number: n, status: "sold", order_id: orderId,
    first_name: n % 2 ? "Dana" : "Alma", last_name: n % 2 ? "Ruiz" : "Castillo",
    email: `buyer${n}@example.com`,
    sold_at: new Date().toISOString(),
  });
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ reducedMotion: "reduce" });
await ctx.addInitScript(() => localStorage.setItem("mlf_age_ok", "1"));
const page = await ctx.newPage();
await page.goto(`${APP}/admin`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "owner@molonlabe.example");
await page.fill('input[type="password"]', "x");
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);

// ------------------------------------------------- the first draw
await page.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /draw without ceremony/i }).click();
await page.waitForTimeout(400);
await page.locator('[role="dialog"] button').first().click();
await page.waitForTimeout(2500);

const first = (await winners())[0];
check("the first draw produced a winner", Boolean(first));
if (!first) {
  await browser.close();
  console.log("no winner; aborting");
  process.exit(1);
}
const fingerprint = (w) => `${w.id}|${w.seed}|${w.ticket}|${w.ticket_index}`;
notes.push(`first draw: spot ${first.ticket}, seed ${first.seed}`);

// -------------------------------- the admin does not offer a second
const adminAfter = await page.locator("body").innerText();
check("ADMIN: the draw control is gone once a winner exists",
  !/draw without ceremony/i.test(adminAfter) && /winner drawn/i.test(adminAfter),
  /draw without ceremony/i.test(adminAfter) ? "STILL OFFERED" : "replaced by the winner");

// ---------------------- the presentation says what it will do, and does it
await page.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
const stageBefore = await page.locator("body").innerText();
check("PRESENTATION: warns that starting will replay, not redraw",
  /already has a winner/i.test(stageBefore) && /will not draw again/i.test(stageBefore),
  (stageBefore.match(/[^\n]*already has a winner[^\n]*/i) ?? ["NO WARNING"])[0].slice(0, 90));
check("PRESENTATION: the button says replay rather than draw",
  await page.getByRole("button", { name: /replay the draw/i }).count() > 0);

await page.getByRole("button", { name: /replay the draw/i }).click();
await page.waitForTimeout(6000);

const afterReplay = await winners();
check("REPLAY: still exactly one winner row", afterReplay.length === 1,
  `${afterReplay.length} rows`);
check("REPLAY: it is the SAME row — not a new draw that agreed by luck",
  fingerprint(afterReplay[0]) === fingerprint(first),
  fingerprint(afterReplay[0]) === fingerprint(first)
    ? `same id, seed and spot ${first.ticket}`
    : `${fingerprint(first)} -> ${fingerprint(afterReplay[0])}`);

const stageAfter = await page.locator("body").innerText();
check("REPLAY: the screen shows the original spot number",
  new RegExp(`Spot ${first.ticket}\\b`, "i").test(stageAfter),
  (stageAfter.match(/Spot \d+[^\n]{0,50}/i) ?? ["NOT SHOWN"])[0]);
check("REPLAY: and the original seed, so the record on camera is unchanged",
  stageAfter.includes(first.seed), first.seed);

// ------------------- and again, twice more, to be sure it is stable
for (let i = 0; i < 2; i++) {
  await page.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /replay the draw/i }).click();
  await page.waitForTimeout(5000);
}
const afterThree = await winners();
check("REPLAY: three replays later, still one unchanged row",
  afterThree.length === 1 && fingerprint(afterThree[0]) === fingerprint(first),
  `${afterThree.length} rows, spot ${afterThree[0]?.ticket}`);

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log("");
for (const n of notes) console.log("· " + n);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
