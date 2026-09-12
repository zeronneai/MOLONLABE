// Where does the winning SPOT NUMBER actually appear?
//
// It is the number read aloud on camera, so "the data is correct" is not
// the finish line — it has to be on the screen being filmed, labelled as
// a spot, and legible.
//
// The fixture is built so the number cannot be mistaken for anything
// else: a 20-spot game with only 12 sold, ids out of spot order. The
// winning spot number is therefore frequently LARGER than the pool size,
// which breaks any wording of the form "N of TOTAL" — that phrasing came
// from the per-dollar model where the ticket was an ordinal position.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const GAME = "77777777-7777-4777-8777-777777777777";

const ok = [], bad = [], notes = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);

const j = { "content-type": "application/json" };
const post = (t, b) =>
  fetch(`${DOUBLE}/rest/v1/${t}`, { method: "POST", headers: j, body: JSON.stringify(b) });

// Spot numbers 1..20; the twelve sold are the HIGH ones, so the winning
// spot number is almost certainly greater than the pool size of 12.
const SOLD = [7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 20];
const hex = "0123456789abcdef";
const idFor = (n) =>
  `${hex[n % 16]}${hex[(n * 7) % 16]}${hex[(n * 3) % 16]}${hex[(n * 11) % 16]}` +
  `ffff-0000-4000-8000-${String(n).padStart(12, "0")}`;

await fetch(`${DOUBLE}/__reset`);
await post("games", {
  id: GAME, title: "Number Game", status: "full",
  total_spots: 20, spot_price_cents: 3000,
});
const orderRes = await fetch(`${DOUBLE}/rest/v1/orders`, {
  method: "POST", headers: { ...j, prefer: "return=representation" },
  body: JSON.stringify({ order_number: "MLF-NUM001", confirmation_token: "t" }),
});
const orderId = (await orderRes.json())[0].id;
for (let n = 1; n <= 20; n++) {
  const sold = SOLD.includes(n);
  await post("game_spots", {
    id: idFor(n), game_id: GAME, spot_number: n,
    status: sold ? "sold" : "open",
    order_id: sold ? orderId : null,
    first_name: sold ? "Dana" : null,
    last_name: sold ? "Ruiz" : null,
    email: sold ? "dana@example.com" : null,
    // Opted in, so the presentation is allowed to show a name at all.
    sold_at: sold ? new Date().toISOString() : null,
  });
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => localStorage.setItem("mlf_age_ok", "1"));
const page = await ctx.newPage();
await page.goto(`${APP}/admin`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "owner@molonlabe.example");
await page.fill('input[type="password"]', "x");
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);

// ------------------------------------------------ draw, via the admin
await page.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /draw without ceremony/i }).click();
await page.waitForTimeout(400);
await page.locator('[role="dialog"] button').first().click();
await page.waitForTimeout(1200);
// Twelve of twenty sold, deliberately — that is what makes the winning
// spot number exceed the pool size and exposes "Entry 16 of 12". It is
// therefore an early draw, and the second confirmation applies.
const early = page.getByRole("button", { name: /draw anyway/i });
if (await early.count()) await early.click();
await page.waitForTimeout(2500);

const row = (await (await fetch(`${DOUBLE}/__dump`)).json()).winners[0];
check("a winner was recorded", Boolean(row));
if (!row) {
  await browser.close();
  console.log("no winner row; aborting");
  process.exit(1);
}
const spot = row.ticket;
const idx = row.ticket_index;
notes.push(`winning spot ${spot}, selector index ${idx}, pool ${row.entry_total}`);
check("the fixture makes spot and index different numbers", spot !== idx,
  `spot ${spot} vs index ${idx}`);
notes.push(
  spot > row.entry_total
    ? `the spot number (${spot}) is LARGER than the pool (${row.entry_total}) — "N of TOTAL" wording is nonsense here`
    : `note: spot ${spot} <= pool ${row.entry_total} this run, so the "N of TOTAL" absurdity is not exercised`,
);

// ------------------------------------------------- 1. the admin page
const admin = await page.locator("body").innerText();
check("ADMIN: names the winner", /winner drawn/i.test(admin));
check("ADMIN: shows the winning spot number",
  new RegExp(`Spot ${spot}\\b`, "i").test(admin),
  (admin.match(/Spot \d+[^\n]{0,60}/i) ?? ["NOT SHOWN"])[0]);
check("ADMIN: does not show the selector's index as if it were a spot",
  !new RegExp(`Spot ${idx}\\b`, "i").test(admin));

// ------------------------------------------- 2. the presentation mode
await page.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
// Reduced motion so the stage skips straight to the result rather than
// animating for several seconds.
await page.emulateMedia({ reducedMotion: "reduce" });
const start = page.getByRole("button", { name: /draw|start|reveal/i }).first();
if (await start.count()) {
  await start.click().catch(() => {});
  await page.waitForTimeout(4000);
}
const stage = await page.locator("body").innerText();
check("PRESENTATION: reaches the winner", /winner/i.test(stage),
  stage.slice(0, 70).replace(/\n/g, " "));
check("PRESENTATION: shows the winning spot number at all",
  new RegExp(`\\b${spot}\\b`).test(stage),
  (stage.match(/[^\n]*\b(entry|spot)\b[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 80));
check("PRESENTATION: labels it as a spot, not an entry",
  new RegExp(`spot\\s*${spot}\\b`, "i").test(stage),
  (stage.match(/[^\n]*\b(entry|spot)\s*\d+[^\n]*/i) ?? ["no such line"])[0].slice(0, 80));
check("PRESENTATION: does not read 'N of TOTAL' with a spot number",
  !new RegExp(`\\b${spot}\\b\\s*(of|/)\\s*${row.entry_total}\\b`, "i").test(stage),
  (stage.match(new RegExp(`[^\\n]*\\b${spot}\\b\\s*of\\s*\\d+[^\\n]*`, "i")) ?? ["clean"])[0].slice(0, 80));

check("PRESENTATION: says how many spots sold, not an impossible fraction",
  new RegExp(`${row.entry_total}\\s*spots?\\s*sold`, "i").test(stage),
  (stage.match(/[^\n]*spots? sold[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 80));
check("PRESENTATION: no leftover 'entries'/'entrants' wording on the filmed screen",
  !/\bentr(y|ies|ant|ants)\b/i.test(stage),
  (stage.match(/[^\n]*\bentr(y|ies|ant|ants)\b[^\n]*/i) ?? ["clean"])[0].slice(0, 70));

// the copy-summary button, which is what gets pasted into the caption
const copyBtn = page.getByRole("button", { name: /copy/i }).first();
let summary = "";
if (await copyBtn.count()) {
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await copyBtn.click().catch(() => {});
  await page.waitForTimeout(400);
  summary = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
}
if (summary) {
  check("SUMMARY: the copied caption names the spot",
    new RegExp(`spot\\s*${spot}\\b`, "i").test(summary),
    (summary.match(/[^\n]*\b(entry|spot)[^\n]*/i) ?? ["not named"])[0].slice(0, 70));
} else {
  notes.push("could not read the clipboard in this browser context; caption not asserted");
}

// -------------------------------------------- 3. the public featured page
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
const featured = await page.locator("body").innerText();
notes.push(
  /winner/i.test(featured)
    ? `FEATURED mentions a winner; spot number present: ${new RegExp(`\\b${spot}\\b`).test(featured)}`
    : "FEATURED shows no past winner section for this game",
);

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log("");
for (const n of notes) console.log("· " + n);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
