// There is no early draw.
//
// The client's rules say a drop runs until every guide is purchased, and
// the checkout terms say the same. The manager runs the site alone for a
// month and must not be able to draw a drop that has not sold out, so
// this is checked for the manager as well as the owner, on every route:
//
//   the admin panel      no draw control at all until the drop is full
//   the presentation     Start is blocked; its handler, called anyway,
//                        reaches the server and the server refuses
//   the database         tests/db/noearlydraw.mjs, which writes a winner
//                        directly as the manager and is refused
//
// And that rehearsal still works on a drop that has not sold out, because
// that is when the owner practises.

import { APP } from "../lib/config.mjs";
import {
  adminPage, browser, dump, insertReturning, managerPage, reset, suite, throughRoster, update,
} from "../lib/harness.mjs";

const { check, report } = suite();
const GAME = "55555555-5555-4555-8555-555555555555";
const TOTAL = 5;
const SOLD = 2; // three short, deliberately

/** Runs a disabled button's own click handler, as a tampered client could. */
const invoke = (locator) =>
  locator.evaluate((el) => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps"));
    el[key].onClick({ preventDefault() {}, stopPropagation() {} });
  });

async function sell(upTo) {
  const order = await insertReturning("orders", {
    order_number: `MLF-EARLY${upTo}`, confirmation_token: "t",
  });
  for (let n = 1; n <= upTo; n++) {
    await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.${n}`, {
      status: "sold", order_id: order.id, first_name: "Dana", last_name: "Ruiz",
      email: "dana@example.com", sold_at: new Date().toISOString(),
    });
  }
}

const b = await browser();

for (const [who, open] of [["OWNER", adminPage], ["MANAGER", managerPage]]) {
  await reset();
  await sell(SOLD);

  // ----------------------------------------------------------- the admin
  const p = await open(b, { viewport: { width: 1280, height: 1200 } });
  await p.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
  const panel = await p.locator("body").innerText();
  check(`${who} ADMIN: no draw button on a drop that has not sold out`,
    (await p.getByRole("button", { name: /draw without ceremony|draw anyway|^draw$/i }).count()) === 0);
  check(`${who} ADMIN: says how many are sold and when it will be drawn`,
    new RegExp(`${SOLD} of ${TOTAL} guides sold`, "i").test(panel) && /drawn once\s+every guide sells/i.test(panel),
    (panel.match(/[^\n]*guides sold[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 100));
  check(`${who} ADMIN: nothing on the page offers an early draw`,
    !/draw (anyway|short|early)|draw before/i.test(panel),
    (panel.match(/[^\n]*draw (anyway|short|early)[^\n]*/i) ?? ["clean"])[0].slice(0, 80));
  check(`${who} ADMIN: the presentation is offered for rehearsal`,
    (await p.getByRole("link", { name: /rehearse the presentation/i }).count()) === 1);

  // ---------------------------------------------------- the presentation
  await p.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
  const setup = await p.locator("body").innerText();
  const start = p.locator(".draw-start");
  check(`${who} PRESENTATION: Start is blocked on a drop that has not sold out`,
    await start.isDisabled(), await start.innerText());
  check(`${who} PRESENTATION: says why, before anything is filmed`,
    /3 of\s*5 guides are\s+still unsold/i.test(setup.replace(/\s+/g, " ")) || /still unsold/i.test(setup),
    (setup.match(/[^\n]*unsold[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 100));
  check(`${who} PRESENTATION: no box to tick past it`,
    (await p.locator("input[type=checkbox]").count()) === 0);

  // A tampered client runs Start's handler anyway. The roster comes up
  // (it is only a list), and the spin asks the server, which refuses.
  await invoke(start);
  await throughRoster(p);
  await p.waitForTimeout(2500);
  const refused = await p.locator("body").innerText();
  check(`${who} SERVER: refuses the draw and says why`,
    new RegExp(`${SOLD} of ${TOTAL} guides sold`, "i").test(refused) && /nothing has been drawn/i.test(refused),
    (refused.match(/[^\n]*guides sold[^\n]*/i) ?? ["NO MESSAGE"])[0].slice(0, 110));
  check(`${who} SERVER: and no winner was written`, (await dump()).winners.length === 0,
    `${(await dump()).winners.length} winners`);

  // Rehearsal is still open on a short drop.
  await p.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Rehearsal" }).click();
  check(`${who} REHEARSAL: can be started on a drop that has not sold out`,
    !(await p.locator(".draw-start").isDisabled()));
  await p.locator(".draw-start").click();
  await throughRoster(p);
  await p.waitForTimeout(9500);
  check(`${who} REHEARSAL: runs to a result and records nothing`,
    /winning guide/i.test(await p.locator("body").innerText()) && (await dump()).winners.length === 0);
  await p.context().close();
}

// ------------------------------------------ a full drop draws as before
{
  await reset();
  await sell(TOTAL);
  const p = await managerPage(b, { viewport: { width: 1280, height: 1200 } });
  await p.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /draw without ceremony/i }).click();
  await p.waitForTimeout(400);
  await p.locator('[role="dialog"] button').first().click();
  await p.waitForTimeout(2500);
  const winners = (await dump()).winners;
  check("FULL DROP: the manager draws it on one confirmation", winners.length === 1,
    `${winners.length} winners`);
  check("FULL DROP: recorded as not early, nothing unsold",
    winners[0]?.drawn_early === false && (winners[0]?.unsold_spots ?? 0) === 0,
    `early=${winners[0]?.drawn_early}, unsold=${winners[0]?.unsold_spots}`);
  await p.context().close();
}

// --------------------------------------------- the terms a buyer agrees to
{
  await reset();
  const p = await (await b.newContext()).newPage();
  await p.goto(`${APP}/featured`, { waitUntil: "networkidle" });
  const buy = await p.locator("body").innerText();
  check("TERMS: the buy control no longer says the shop may draw early",
    !/draw earlier|at its discretion/i.test(buy));
  check("TERMS: it says the winner is drawn once the last guide sells",
    /drawn once the last guide sells\./i.test(buy));
  await p.context().close();
}

await b.close();
report();
