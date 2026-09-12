// Can a third party re-run this draw and get the same winner?
//
// That is the property the seeded selector exists for, and it is the
// thing the client has been told protects him from an accusation of
// rigging. An insert that no longer errors is not evidence of it.
//
// So this does the whole loop: draws through the admin UI, reads back
// only what was written to the winners row, and re-runs the selection
// from that row alone — no access to game_spots, no access to anything
// the shop could change afterwards. Then it asserts the same spot comes
// out.
//
// The algorithm is imported from lib/draw/select.ts rather than
// reimplemented here. A copy would drift, and a test that verifies a
// draw against its own private copy of the algorithm proves nothing.

import { chromium } from "playwright";
import { selectWinner, verifyDraw } from "../../lib/draw/select.ts";
import { APP, DOUBLE, CHROMIUM, ROOT } from "../lib/config.mjs";



const GAME = "66666666-6666-4666-8666-666666666666";

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);

// Ids deliberately NOT in spot order, and the sold spots deliberately
// non-contiguous. The selector sorts the pool by id, so with a tidy
// fixture — spots 1..5, ids ending 1..5 — the algorithm's index and the
// spot number are the same number by accident, and a mix-up between them
// is invisible. This fixture makes them differ.
const SPOTS = [
  { spot_number: 1, id: "ffffffff-0000-4000-8000-0000000000f1", sell: true },
  { spot_number: 2, id: "11111111-0000-4000-8000-0000000000a2", sell: false },
  { spot_number: 3, id: "99999999-0000-4000-8000-0000000000c3", sell: true },
  { spot_number: 4, id: "33333333-0000-4000-8000-0000000000d4", sell: true },
  { spot_number: 5, id: "77777777-0000-4000-8000-0000000000e5", sell: true },
  { spot_number: 6, id: "22222222-0000-4000-8000-0000000000b6", sell: true },
];

const j = { "content-type": "application/json" };
const post = (t, b) =>
  fetch(`${DOUBLE}/rest/v1/${t}`, { method: "POST", headers: j, body: JSON.stringify(b) });

await fetch(`${DOUBLE}/__reset`);

// A game of six spots, five sold to two buyers.
await post("games", {
  id: GAME, title: "Audit Game", status: "full",
  total_spots: 6, spot_price_cents: 3000,
});
const orderRes = await fetch(`${DOUBLE}/rest/v1/orders`, {
  method: "POST", headers: { ...j, prefer: "return=representation" },
  body: JSON.stringify({ order_number: "MLF-AUDIT1", confirmation_token: "t" }),
});
const orderId = (await orderRes.json())[0].id;

for (const s of SPOTS) {
  await post("game_spots", {
    id: s.id, game_id: GAME, spot_number: s.spot_number,
    status: s.sell ? "sold" : "open",
    order_id: s.sell ? orderId : null,
    first_name: s.sell ? (s.spot_number % 2 ? "Dana" : "Alma") : null,
    last_name: s.sell ? (s.spot_number % 2 ? "Ruiz" : "Castillo") : null,
    email: s.sell ? "buyer@example.com" : null,
    show_name: true,
    sold_at: s.sell ? new Date().toISOString() : null,
  });
}

// ------------------------------------------------- draw it for real
const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext();
await ctx.addInitScript(() => localStorage.setItem("mlf_age_ok", "1"));
const page = await ctx.newPage();
await page.goto(`${APP}/admin`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "owner@molonlabe.example");
await page.fill('input[type="password"]', "x");
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);
await page.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /draw without ceremony/i }).click();
await page.waitForTimeout(400);
await page.locator('[role="dialog"] button').first().click();
await page.waitForTimeout(2500);

const screen = await page.locator("body").innerText();
const dump = await (await fetch(`${DOUBLE}/__dump`)).json();
const row = dump.winners[0];

check("the draw produced a winner row", Boolean(row),
  row ? "" : "NOTHING WRITTEN");

if (!row) {
  await browser.close();
  for (const l of ok) console.log(l);
  for (const l of bad) console.log(l);
  console.log(`\n${ok.length} passed, ${bad.length} failed`);
  process.exit(1);
}

// --------------------------------- the audit trail is actually there
check("the seed was recorded", Boolean(row.seed), String(row.seed));
check("the pool was recorded", Array.isArray(row.pool),
  Array.isArray(row.pool) ? `${row.pool.length} spots` : String(row.pool));
check("the pool size was recorded", row.entry_total === 5, String(row.entry_total));
check("the selector's index was recorded", typeof row.ticket_index === "number",
  String(row.ticket_index));
check("the pool holds only the spots that sold",
  Array.isArray(row.pool) &&
    row.pool.length === 5 &&
    !row.pool.some((p) => p.spot_number === 2),
  Array.isArray(row.pool) ? row.pool.map((p) => p.spot_number).join(",") : "—");

// ------------------------------------ the ticket is the SPOT NUMBER
const soldNumbers = SPOTS.filter((s) => s.sell).map((s) => s.spot_number);
check("the recorded ticket is a real sold spot number",
  soldNumbers.includes(row.ticket), `ticket ${row.ticket} of sold ${soldNumbers.join(",")}`);
check("the ticket is the spot number, not the selector's index",
  row.ticket === row.pool[row.ticket_index - 1].spot_number,
  `ticket ${row.ticket}, index ${row.ticket_index} -> spot ${row.pool[row.ticket_index - 1].spot_number}`);
// The fixture is built so these differ. If they ever coincide the test
// above has stopped being able to tell them apart, and that is worth
// knowing rather than silently passing.
check("the fixture genuinely distinguishes the two numbers",
  row.ticket !== row.ticket_index,
  `ticket ${row.ticket} vs index ${row.ticket_index} — if equal, this test proves less than it looks`);

// ----------------------------- THE PROPERTY: re-run it independently
// Only the winners row is used from here. Nothing is read back from
// game_spots, so a change to the shop's data after the draw cannot alter
// the verdict.
const replay = selectWinner(
  row.pool.map((p) => ({ id: p.spot_id, weight: 1 })),
  row.seed,
);
const replayedSpot = row.pool.find((p) => p.spot_id === replay.entrantId);

check("re-running the recorded seed picks the same spot",
  replayedSpot.spot_number === row.ticket,
  `re-run gave spot ${replayedSpot.spot_number}, the draw announced spot ${row.ticket}`);
check("and the same spot id, not merely the same number",
  replay.entrantId === row.spot_id,
  `${replay.entrantId} vs ${row.spot_id}`);
check("and the same index into the pool",
  replay.ticket === row.ticket_index, `${replay.ticket} vs ${row.ticket_index}`);

// The same check the application runs on itself before it stores a row.
const verdict = verifyDraw({
  seed: row.seed, pool: row.pool, ticketIndex: row.ticket_index,
  ticket: row.ticket, total: row.entry_total,
});
check("verifyDraw agrees the record reproduces", verdict.ok,
  verdict.ok ? `spot ${verdict.spotNumber}` : verdict.reason);

// Ten more times, to rule out a fluke.
const repeats = Array.from({ length: 10 }, () =>
  selectWinner(row.pool.map((p) => ({ id: p.spot_id, weight: 1 })), row.seed).entrantId);
check("the result is stable across repeated re-runs",
  new Set(repeats).size === 1 && repeats[0] === row.spot_id);

// Row order must not matter: Postgres promises nothing without ORDER BY.
const shuffled = [...row.pool].sort(() => Math.random() - 0.5);
check("the pool arriving in a different order changes nothing",
  selectWinner(shuffled.map((p) => ({ id: p.spot_id, weight: 1 })), row.seed)
    .entrantId === row.spot_id);

// ------------------------------------------------ the teeth of it all
// A verification that cannot fail is decoration. A different seed must
// land somewhere else at least sometimes, and a tampered record must be
// rejected.
const others = Array.from({ length: 40 }, (_, i) =>
  selectWinner(row.pool.map((p) => ({ id: p.spot_id, weight: 1 })), `tampered${i}`).entrantId);
check("a different seed does not always give the same winner",
  new Set(others).size > 1, `${new Set(others).size} distinct winners across 40 seeds`);

check("verifyDraw rejects a record whose announced spot was altered",
  !verifyDraw({ seed: row.seed, pool: row.pool, ticketIndex: row.ticket_index,
    ticket: soldNumbers.find((n) => n !== row.ticket), total: row.entry_total }).ok);
// A single altered seed can land on the same spot by chance — with five
// spots that is a one-in-five false pass. So this asserts that ALTERING
// THE SEED IS DETECTED, over enough different seeds that a coincidence
// cannot carry it, and reports how many slipped through.
const tamperedSeeds = Array.from({ length: 50 }, (_, i) => `tampered-seed-${i}`);
const undetected = tamperedSeeds.filter(
  (bad) =>
    verifyDraw({ seed: bad, pool: row.pool, ticketIndex: row.ticket_index,
      ticket: row.ticket, total: row.entry_total }).ok,
);
check("altering the seed is detected far more often than chance allows",
  undetected.length <= tamperedSeeds.length / 3,
  `${undetected.length} of ${tamperedSeeds.length} altered seeds went undetected ` +
  `(a pool of ${row.entry_total} means roughly 1 in ${row.entry_total} can coincide)`);
check("verifyDraw rejects a record with a spot added to the pool after the fact",
  !verifyDraw({ seed: row.seed,
    pool: [...row.pool, { spot_id: SPOTS[1].id, spot_number: 2 }],
    ticketIndex: row.ticket_index, ticket: row.ticket, total: row.entry_total }).ok);
check("verifyDraw rejects a record with no pool at all",
  !verifyDraw({ seed: row.seed, pool: [], ticketIndex: 1, ticket: 1, total: 0 }).ok);

// --------------------------------------- and the screen agrees with it
check("the screen names the spot that was actually drawn",
  new RegExp(`Spot ${row.ticket}\\b`).test(screen),
  (screen.match(/Spot \d+[^\n]*/) ?? ["not shown"])[0]);
// The name is uppercased in CSS, so match case-insensitively — what
// matters is that it is a given name plus a single initial and that no
// surname survived the redaction.
const shown = (screen.match(/WINNER DRAWN\s*\n+\s*([^\n]+)/i) ?? ["", ""])[1].trim();
// Scoped to the winner block, not the page: the owner's spot ledger
// shows full buyer names on purpose, and that is not a leak.
check("the winner shown is first name plus last initial only",
  /^[A-Za-z]+ [A-Za-z]\.$/.test(shown) && !/castillo|ruiz/i.test(shown),
  shown || "nothing shown");

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
