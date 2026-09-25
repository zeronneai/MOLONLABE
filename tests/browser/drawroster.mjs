// The roster and the wheel: rules clause 15, held to its word.
//
// "Before the wheel is spun, every entry is shown on screen so viewers can
// confirm all buyers were included. The result is recorded."
//
// The video is the proof, so this drives a large drop, 300 buyers and
// over 700 guides, through the real presentation in both orientations
// and asserts, from what is actually on screen:
//
//   - every buyer appears, once, with the right guide count, and no row
//     on any page is clipped by the frame or cut short
//   - the running numbers are continuous across pages, and the total
//     shown equals the guides sold
//   - the wheel cannot be spun until every page has been shown
//   - no email or surname reaches the page at all
//   - the wheel stops with the pointer inside the recorded winner's wedge,
//     and says the recorded winner's name
//   - a replay stops in the same place
//   - if a guide sells after the roster was shown, nothing is drawn

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, ARTIFACTS } from "../lib/config.mjs";
import { adminPage, browser, dump, insert, reset, suite, update } from "../lib/harness.mjs";

const { check, note, report } = suite();
const SHOTS = join(ARTIFACTS, "drawroster");
mkdirSync(SHOTS, { recursive: true });

const BIG = "66666666-6666-4666-8666-666666666666";
const FIRST = ["Ana", "Luis", "Marco", "Elena", "Dana", "Rey", "Tomas", "Nadia", "Cole", "Rosa",
  "Hugo", "Isela", "Kai", "Paloma", "Beau", "Ximena", "Owen", "Talia", "Mateo", "Bree"];

// ------------------------------------------------ a large drop, sold out
await reset();
const buyers = [];
let n = 0;
for (let i = 0; i < 300; i += 1) {
  const count = (i * 7) % 5 === 0 ? 5 : (i % 3) + 1;
  // Same first name and last initial for different people is common, and
  // they must stay separate lines: grouped by email, not by name.
  const first = FIRST[i % FIRST.length];
  const last = `${String.fromCharCode(65 + (i % 7))}zzsurname${i}`;
  const numbers = Array.from({ length: count }, () => ++n);
  buyers.push({ email: `buyer${i}@example.com`, first, last, numbers });
}
// One buyer who came back and bought again in a second order: one line.
buyers[5].numbers.push(++n, ++n);
const TOTAL = n;

await insert("games", {
  id: BIG, title: "Big Drop", item_id: null, description: null, status: "full",
  winner_note: null, total_spots: TOTAL, spot_price_cents: 1000,
  guide_why: "x".repeat(60), guide_care: "x".repeat(60), guide_pairs: "x".repeat(60),
  created_at: new Date().toISOString(),
});
const rows = buyers.flatMap((b) => b.numbers.map((num) => ({
  game_id: BIG, spot_number: num, status: "sold", order_id: null,
  first_name: b.first, last_name: b.last, email: b.email, phone: null,
  held_at: null, sold_at: new Date().toISOString(),
})));
for (let i = 0; i < rows.length; i += 200) await insert("game_spots", rows.slice(i, i + 200));
const expected = buyers
  .map((b) => `${b.first} ${b.last[0]}.|${b.numbers.length}`)
  .sort();
note(`${buyers.length} buyers, ${TOTAL} guides`);

const b = await browser();

/** Reads the roster page by page, checking each row is fully on screen. */
async function readRoster(p, label) {
  await p.locator("[data-roster-page]").waitFor({ timeout: 15000 });
  const got = [];
  const clipped = [];
  const pages = Number(await p.locator("[data-roster-page]").getAttribute("data-roster-pages"));
  let spinOfferedEarly = false;
  for (let page = 1; page <= pages; page += 1) {
    await p.waitForFunction((want) =>
      document.querySelector("[data-roster-page]")?.getAttribute("data-roster-page") === String(want), page);
    if (page === 1) await p.screenshot({ path: join(SHOTS, `${label}-roster-first.png`) });
    if (page < pages && (await p.getByRole("button", { name: /spin the wheel/i }).count())) {
      spinOfferedEarly = true;
    }
    const pageRows = await p.evaluate(() => {
      const frame = document.querySelector(".draw-frame").getBoundingClientRect();
      return [...document.querySelectorAll("[data-roster-entry]")].map((li) => {
        const r = li.getBoundingClientRect();
        const name = li.querySelector(".draw-roster-name");
        return {
          n: Number(li.querySelector(".draw-roster-n").textContent),
          name: name.textContent,
          count: Number(li.querySelector(".draw-roster-count").textContent.match(/\d+/)[0]),
          inside: r.top >= frame.top - 0.5 && r.bottom <= frame.bottom + 0.5 &&
            r.left >= frame.left - 0.5 && r.right <= frame.right + 0.5,
          cut: name.scrollWidth > name.clientWidth + 1,
        };
      });
    });
    for (const r of pageRows) {
      got.push(r);
      if (!r.inside || r.cut) clipped.push(`page ${page}: #${r.n} ${r.name}${r.cut ? " (cut short)" : ""}`);
    }
    if (page === pages) await p.screenshot({ path: join(SHOTS, `${label}-roster-last.png`) });
    if (page < pages) {
      await p.waitForTimeout(1600);
      await p.keyboard.press("ArrowRight");
    }
  }
  return { got, clipped, pages, spinOfferedEarly };
}

function judge(label, { got, clipped, pages, spinOfferedEarly }, foot) {
  const list = got.map((r) => `${r.name}|${r.count}`).sort();
  check(`${label}: every buyer is on the roster, once, with the right count`,
    JSON.stringify(list) === JSON.stringify(expected),
    `${got.length} rows read of ${expected.length}; first difference: ${
      list.find((x, i) => x !== expected[i]) ?? "none"}`);
  check(`${label}: the running numbers run 1 to ${buyers.length} with no gap`,
    got.every((r, i) => r.n === i + 1), `${got[0]?.n}…${got.at(-1)?.n}`);
  check(`${label}: no row on any of ${pages} pages is clipped or cut short`,
    clipped.length === 0, clipped.slice(0, 3).join("; ") || `${pages} pages clean`);
  check(`${label}: the total shown is the guides sold`,
    new RegExp(`${buyers.length}\\s*buyers\\s*·\\s*${TOTAL}\\s*guides\\s*·\\s*all\\s*${TOTAL}\\s*sold`, "i")
      .test(foot.replace(/,/g, "")), foot);
  check(`${label}: Spin is not offered before the last page`, !spinOfferedEarly);
}

/** Where the wheel stopped, and whose wedge is under the pointer there. */
async function stopped(p) {
  return p.evaluate(() => {
    const rot = Number(document.querySelector(".draw-wheel").dataset.rotation);
    const at = (((360 - (rot % 360)) % 360) + 360) % 360;
    const wedges = [...document.querySelectorAll("[data-wedge]")];
    const under = wedges.find((w) => at >= Number(w.dataset.start) && at < Number(w.dataset.end));
    const win = document.querySelector("[data-winner='true']");
    return {
      rot,
      under: under?.dataset.name,
      underIsWinner: under === win,
      margin: under ? Math.min(at - Number(under.dataset.start), Number(under.dataset.end) - at) : -1,
      readout: document.querySelector("[data-readout]").textContent,
      wedges: wedges.length,
    };
  });
}

// =================================================== 9:16, the real draw
const p = await adminPage(b, { viewport: { width: 540, height: 960 } });
await p.goto(`${APP}/draw/${BIG}`, { waitUntil: "networkidle" });
const html = await p.content();
check("no buyer's email reaches the page", !html.includes("@example.com"));
check("no buyer's surname reaches the page", !/zzsurname/i.test(html));

await p.getByRole("button", { name: /start the draw/i }).click();
await p.keyboard.press("Space");
await p.waitForTimeout(400);
check("pressing Space on the first page draws nothing", (await dump()).winners.length === 0);

const vertical = await readRoster(p, "9x16");
const footV = await p.locator("[data-roster-total]").innerText();
judge("9:16", vertical, footV);

const measure = p.evaluate(() => new Promise((resolve) => {
  const deltas = [];
  let last = performance.now();
  const until = last + 7000;
  const tick = (now) => {
    deltas.push(now - last);
    last = now;
    if (now < until) requestAnimationFrame(tick);
    else resolve(deltas);
  };
  requestAnimationFrame(tick);
}));
await p.getByRole("button", { name: /spin the wheel/i }).click();
await p.waitForTimeout(2500);
await p.screenshot({ path: join(SHOTS, "9x16-spin.png") });
const deltas = await measure;
await p.waitForTimeout(7000);
await p.screenshot({ path: join(SHOTS, "9x16-result.png") });

const d = await dump();
const winner = d.winners.find((w) => w.game_id === BIG);
check("the draw was recorded when Spin was pressed", Boolean(winner));
const holder = buyers.find((x) => x.numbers.includes(winner?.ticket));
const s1 = await stopped(p);
check("one wedge per buyer", s1.wedges === buyers.length, `${s1.wedges}`);
check("the wheel stops with the pointer inside the winner's wedge",
  s1.underIsWinner, `under ${s1.under}, ${s1.margin.toFixed(2)}° from its edge`);
check("well inside it, not on a line", s1.margin > 0.05, `${s1.margin.toFixed(3)}°`);
check("the name on screen is the recorded winner",
  s1.readout === winner?.display_name && s1.readout === `${holder.first} ${holder.last[0]}.`,
  `${s1.readout} / recorded ${winner?.display_name}`);
const long = deltas.filter((x) => x > 34).length;
check("the spin holds its frame rate with 300 wedges",
  long / deltas.length < 0.1, `${long} of ${deltas.length} frames over 34 ms`);
note(`median frame ${deltas.sort((a, c) => a - c)[Math.floor(deltas.length / 2)].toFixed(1)} ms`);

// =============================================== 16:9, replaying the take
await p.setViewportSize({ width: 1280, height: 720 });
await p.goto(`${APP}/draw/${BIG}`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: "16:9" }).click();
await p.getByRole("button", { name: /replay the draw/i }).click();
const horizontal = await readRoster(p, "16x9");
judge("16:9", horizontal, await p.locator("[data-roster-total]").innerText());
await p.getByRole("button", { name: /spin the wheel/i }).click();
await p.waitForTimeout(4000);
await p.screenshot({ path: join(SHOTS, "16x9-spin.png") });
await p.waitForTimeout(5500);
await p.screenshot({ path: join(SHOTS, "16x9-result.png") });
const s2 = await stopped(p);
check("a replay records nothing new", (await dump()).winners.filter((w) => w.game_id === BIG).length === 1);
check("and stops exactly where the take did", s2.rot === s1.rot && s2.readout === s1.readout,
  `${s1.rot}° ${s1.readout} then ${s2.rot}° ${s2.readout}`);

// ============== a small drop: one column in large type, still all there
{
  const SMALL = "77777777-7777-4777-8777-777777777777";
  await insert("games", {
    id: SMALL, title: "Small Drop", item_id: null, description: null, status: "full",
    winner_note: null, total_spots: 20, spot_price_cents: 1000,
    guide_why: "x".repeat(60), guide_care: "x".repeat(60), guide_pairs: "x".repeat(60),
    created_at: new Date().toISOString(),
  });
  // Twelve buyers, the most that get the large layout, with the longest
  // first names on the list, so the tightest case is the one checked.
  const names = ["Maximiliano", "Guadalupe", "Esperanza", "Bartholomew", "Anastasia", "Christopher",
    "Evangelina", "Fitzgerald", "Genevieve", "Leopoldina", "Montgomery", "Ximena"];
  let num = 0;
  const small = [];
  for (const [i, first] of names.entries()) {
    const count = i < 8 ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      num += 1;
      small.push({ game_id: SMALL, spot_number: num, status: "sold", order_id: null,
        first_name: first, last_name: "Quintanilla", email: `s${i}@example.com`, phone: null,
        held_at: null, sold_at: new Date().toISOString() });
    }
  }
  await insert("game_spots", small);
  for (const [label, viewport, button] of [
    ["small 9:16", { width: 540, height: 960 }, "9:16"],
    ["small 16:9", { width: 1280, height: 720 }, "16:9"],
  ]) {
    const q = await adminPage(b, { viewport });
    await q.goto(`${APP}/draw/${SMALL}`, { waitUntil: "networkidle" });
    await q.getByRole("button", { name: button }).click();
    await q.getByRole("button", { name: /start the draw/i }).click();
    const r = await readRoster(q, label.replace(/[ :]/g, "-"));
    check(`${label}: one large page, twelve buyers, nothing clipped or cut short`,
      r.pages === 1 && r.got.length === 12 && r.clipped.length === 0 &&
        (await q.locator(".draw-roster-list[data-size='large']").count()) === 1,
      `${r.pages} page(s), ${r.got.length} rows; ${r.clipped.join("; ") || "clean"}`);
    await q.context().close();
  }
}

// ============================== a guide sells after the roster was shown
{
  await reset();
  const GAME = "55555555-5555-4555-8555-555555555555";
  for (const num of [1, 2, 3]) {
    await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.${num}`, {
      status: "sold", first_name: "Ana", last_name: `Lopez${num}`, email: `a${num}@example.com`,
      sold_at: new Date().toISOString(),
    });
  }
  const q = await adminPage(b, { viewport: { width: 540, height: 960 } });
  await q.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
  await q.locator(".draw-note-ack input[type=checkbox]").check();
  await q.getByRole("button", { name: /start the draw/i }).click();
  await q.locator("[data-roster-page]").waitFor();
  // A checkout completes while the roster is on screen.
  await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.4`, {
    status: "sold", first_name: "Late", last_name: "Buyer", email: "late@example.com",
    sold_at: new Date().toISOString(),
  });
  await q.waitForTimeout(1700);
  await q.getByRole("button", { name: /spin the wheel/i }).click();
  await q.waitForTimeout(1500);
  const text = await q.locator("body").innerText();
  check("a guide sold after the roster was shown: nothing is drawn",
    (await dump()).winners.length === 0, `${(await dump()).winners.length} winners`);
  check("and the screen says why",
    /changed after it was shown/i.test(text), (text.match(/[^\n]*changed[^\n]*/i) ?? ["NOTHING SAID"])[0]);
}

await b.close();
report();
