// Closing a drop's sales before it sells out, as the manager and the owner.
//
// 30 October 2026: BOOM STICK had to be drawn for Halloween at 44 of 66.
// With no way to end a drop early, the drawing was run outside the site
// and the unsold guides were recorded as a fake in-store sale to stop it
// selling. This is the control that replaces that.
//
// For each of the owner and the manager:
//   the admin        "Close sales" is offered on an open drop with sales,
//                    asks to confirm on the page, and closes it
//   afterwards       the draw is offered on the guides sold, and the page
//                    says who closed it
//   the public page  says SALES CLOSED and offers nothing to buy
// The database side (nobody can buy in by any path, voids never reopen,
// a short drop that is not closed still cannot be drawn) is in
// tests/db/closesales.mjs.

import { APP } from "../lib/config.mjs";
import {
  adminPage, browser, dump, insertReturning, managerPage, reset, suite, update,
} from "../lib/harness.mjs";

const { check, report } = suite();
const GAME = "55555555-5555-4555-8555-555555555555";
const SOLD = 2;

async function sell(upTo) {
  const order = await insertReturning("orders", {
    order_number: `MLF-CLOSE${upTo}`, confirmation_token: "t",
  });
  for (let n = 1; n <= upTo; n++) {
    await update("game_spots", `game_id=eq.${GAME}&spot_number=eq.${n}`, {
      status: "sold", order_id: order.id, first_name: "Dana", last_name: "Ruiz",
      email: "dana@example.com", sold_at: new Date().toISOString(),
    });
  }
}

const b = await browser();

for (const [who, open, name] of [["MANAGER", managerPage, "Luis Ortega"], ["OWNER", adminPage, "Rey Marquez"]]) {
  await reset();
  await sell(SOLD);

  const p = await open(b, { viewport: { width: 1280, height: 1200 } });
  await p.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
  const offer = p.getByRole("button", { name: /^close sales$/i });
  check(`${who}: an open drop with sales offers "Close sales"`, (await offer.count()) === 1);
  await offer.click();
  const confirm = p.getByRole("button", { name: /yes, close sales/i });
  check(`${who}: it asks to confirm on the page first`, (await confirm.count()) === 1);
  check(`${who}: and nothing has closed yet`,
    !(await dump()).games.find((g) => g.id === GAME)?.sales_closed_at);
  await confirm.click();
  await p.getByText(/Sales closed with/i).waitFor({ timeout: 10000 });

  const g = (await dump()).games.find((x) => x.id === GAME);
  check(`${who}: the drop is now closed, stamped with who`,
    g?.status === "full" && Boolean(g?.sales_closed_at) && g?.sales_closed_by_name === name,
    `${g?.status} ${g?.sales_closed_by_name}`);

  await p.reload({ waitUntil: "networkidle" });
  const panel = await p.locator("body").innerText();
  check(`${who}: the page says who closed it and at how many`,
    new RegExp(`by ${name} at ${SOLD} of \\d+ guides sold`, "i").test(panel),
    (panel.match(/[^\n]*Closed [^\n]*/) ?? ["NOT SHOWN"])[0].slice(0, 120));
  check(`${who}: the draw is now offered on the guides sold`,
    (await p.getByRole("button", { name: /draw without ceremony/i }).count()) === 1 &&
    (await p.getByRole("link", { name: /^presentation mode$/i }).count()) === 1);
  check(`${who}: "Close sales" is no longer offered`,
    (await p.getByRole("button", { name: /^close sales$/i }).count()) === 0);
  await p.context().close();

  const pub = await (await b.newContext()).newPage();
  await pub.addInitScript(() => {
    localStorage.setItem("mlf_age_ok", "1");
    sessionStorage.setItem("mlf_intro_done", "1");
  });
  await pub.goto(`${APP}/games/${GAME}`, { waitUntil: "networkidle" });
  const text = await pub.locator("body").innerText();
  check(`${who}: the public page says sales are closed`,
    /SALES CLOSED\./.test(text) && /Sales closed, awaiting the draw/i.test(text),
    (text.match(/[^\n]*(SOLD OUT|SALES CLOSED|Open now)[^\n]*/i) ?? ["?"])[0]);
  check(`${who}: and offers nothing to buy`,
    (await pub.getByRole("button", { name: /add to cart|get your guide/i }).count()) === 0);
  await pub.context().close();
}

await b.close();
report();
