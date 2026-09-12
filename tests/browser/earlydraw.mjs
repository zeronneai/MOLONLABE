// Drawing a game that has not sold out.
//
// The owner is allowed to. The terms buyers accepted are not — they say
// the game runs until the last spot sells — so the point of this is that
// it cannot happen by accident, that the shortfall is named back to him
// before he confirms, and that it is recorded rather than remembered.
//
// Both routes are covered, because they ask differently on purpose: the
// admin uses a modal, and the filmed presentation asks on the setup
// screen instead, before anything is recorded.

import { chromium } from "playwright";
import { APP, CHROMIUM } from "../lib/config.mjs";
import { suite, reset, insertReturning, insert, update, dump, adminPage, page as newPage } from "../lib/harness.mjs";

const { check, note, report } = suite();
const GAME = "55555555-5555-4555-8555-555555555555";
const TOTAL = 5;
const SOLD = 2; // three short, deliberately

await reset();
const order = await insertReturning("orders", {
  order_number: "MLF-EARLY1",
  confirmation_token: "t",
});
for (let n = 1; n <= SOLD; n++) {
  await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.${n}`, {
    status: "sold",
    order_id: order.id,
    first_name: "Dana",
    last_name: "Ruiz",
    email: "dana@example.com",
    show_name: true,
    sold_at: new Date().toISOString(),
  });
}

const browser = await chromium.launch({ executablePath: CHROMIUM });

// ------------------------------------------------------------- the admin
{
  const page = await adminPage(browser);
  await page.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /draw without ceremony/i }).click();
  await page.waitForTimeout(400);
  await page.locator('[role="dialog"] button').first().click();
  await page.waitForTimeout(2500);

  const body = await page.locator("body").innerText();
  const unsold = TOTAL - SOLD;

  check("ADMIN: the first confirmation does not draw a short game",
    (await dump()).winners.length === 0,
    `${(await dump()).winners.length} winners after the first confirm`);
  check("ADMIN: a second confirmation names the shortfall",
    new RegExp(`${unsold}\\s*of\\s*${TOTAL}`, "i").test(body),
    (body.match(/\d+ OF \d+ SPOTS UNSOLD[^\n]*/i) ?? ["NOT NAMED"])[0]);
  check("ADMIN: and says why it matters, not just 'are you sure'",
    /against the terms/i.test(body));

  // Backing out must leave the game untouched.
  await page.getByRole("button", { name: /wait for the rest/i }).click();
  await page.waitForTimeout(600);
  check("ADMIN: backing out draws nothing",
    (await dump()).winners.length === 0);

  // Now go through.
  await page.getByRole("button", { name: /draw without ceremony/i }).click();
  await page.waitForTimeout(400);
  await page.locator('[role="dialog"] button').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /draw anyway/i }).click();
  await page.waitForTimeout(2500);

  const winners = (await dump()).winners;
  check("ADMIN: confirming draws the game", winners.length === 1,
    `${winners.length} winners`);
  check("ADMIN: the winner records that it was early",
    winners[0]?.drawn_early === true, String(winners[0]?.drawn_early));
  check("ADMIN: and how many were unsold",
    winners[0]?.unsold_spots === unsold,
    `${winners[0]?.unsold_spots} recorded, ${unsold} actual`);
  check("ADMIN: the winner still came from a SOLD spot",
    (winners[0]?.ticket ?? 0) <= SOLD,
    `spot ${winners[0]?.ticket} of ${SOLD} sold`);

  await page.context().close();
}

// ------------------------------------------- a full game asks nothing
{
  await reset();
  const o = await insertReturning("orders", {
    order_number: "MLF-FULL1", confirmation_token: "t",
  });
  for (let n = 1; n <= TOTAL; n++) {
    await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.${n}`, {
      status: "sold", order_id: o.id, first_name: "Alma", last_name: "Castillo",
      email: "alma@example.com", show_name: true, sold_at: new Date().toISOString(),
    });
  }
  const page = await adminPage(browser);
  await page.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /draw without ceremony/i }).click();
  await page.waitForTimeout(400);
  await page.locator('[role="dialog"] button').first().click();
  await page.waitForTimeout(2500);

  const winners = (await dump()).winners;
  check("FULL GAME: draws on one confirmation, no extra question",
    winners.length === 1, `${winners.length} winners`);
  check("FULL GAME: is not marked early",
    winners[0]?.drawn_early === false, String(winners[0]?.drawn_early));
  check("FULL GAME: records zero unsold",
    (winners[0]?.unsold_spots ?? 0) === 0, String(winners[0]?.unsold_spots));
  await page.context().close();
}

// -------------------------------------- the filmed presentation screen
{
  await reset();
  const o = await insertReturning("orders", {
    order_number: "MLF-EARLY2", confirmation_token: "t",
  });
  for (let n = 1; n <= SOLD; n++) {
    await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.${n}`, {
      status: "sold", order_id: o.id, first_name: "Dana", last_name: "Ruiz",
      email: "dana@example.com", show_name: true, sold_at: new Date().toISOString(),
    });
  }
  const page = await adminPage(browser, { reducedMotion: "reduce" });
  await page.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
  const setup = await page.locator("body").innerText();

  check("PRESENTATION: the shortfall is on the SETUP screen, before filming",
    /\bunsold\b/i.test(setup) && /terms/i.test(setup) && /\b3\b/.test(setup),
    (setup.match(/[^\n]*unsold[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 100));

  const startBtn = page.locator(".draw-start");
  check("PRESENTATION: the start control is blocked until acknowledged",
    await startBtn.isDisabled(),
    await startBtn.innerText());

  await page.locator(".draw-note-ack input[type=checkbox]").check();
  await page.waitForTimeout(300);
  check("PRESENTATION: ticking the box unblocks it",
    !(await startBtn.isDisabled()));

  await startBtn.click();
  await page.waitForTimeout(6000);
  const winners = (await dump()).winners;
  check("PRESENTATION: the draw runs and is marked early",
    winners.length === 1 && winners[0]?.drawn_early === true,
    `${winners.length} winners, early=${winners[0]?.drawn_early}`);

  // The filmed screen must not put the terms dialog mid-take.
  const stage = await page.locator("body").innerText();
  check("PRESENTATION: no confirmation dialog appeared during the draw",
    (await page.locator('[role="dialog"]').count()) === 0);
  note(`winning spot ${winners[0]?.ticket}, ${winners[0]?.unsold_spots} unsold`);

  await page.context().close();
}

// -------------------------------------- it is shown publicly afterwards
{
  const page = await newPage(browser);
  await page.goto(`${APP}/games`, { waitUntil: "networkidle" });
  const games = await page.locator("body").innerText();
  check("PUBLIC: a game drawn short says so on its card",
    /drawn with \d+ unsold/i.test(games),
    (games.match(/drawn with \d+ unsold/i) ?? ["NOT SHOWN"])[0]);
  await page.context().close();
}

await browser.close();
report();
