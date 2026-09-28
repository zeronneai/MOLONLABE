// Record an in-store sale, through the admin, as the people who will.
//
// The manager runs the site alone for a month and will enter counter
// sales on a phone. This drives the real form and reads the results
// where the shop will look for them: the drop's ledger, the orders list,
// the activity log, the buyer's email and guide, the draw's roster. Then
// the owner voids one, and the manager is shown that they cannot.
//
// The database rules themselves (numbering, the race with online
// checkout, who may void) are in tests/db/instore.mjs.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, ARTIFACTS } from "../lib/config.mjs";
import { adminPage, browser, dump, managerPage, reset, suite, throughRoster } from "../lib/harness.mjs";

const { check, note, report } = suite();
const GAME = "55555555-5555-4555-8555-555555555555";
const ACK = "The buyer was shown the rules and agreed, including that their first name and last initial appear in the drawing broadcast.";

await reset();
const b = await browser();
const m = await managerPage(b, { viewport: { width: 1280, height: 1400 } });
const pageText = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const result = (p) => p.locator("[data-in-store-result]").innerText().catch(() => "");

async function record(p, { first, last, phone, email = "", qty, tick = true, bypassMax = false }) {
  await p.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
  const form = p.locator("[data-in-store-sale] form");
  await form.locator('[name="first_name"]').fill(first);
  await form.locator('[name="last_name"]').fill(last);
  await form.locator('[name="phone"]').fill(phone);
  if (email) await form.locator('[name="email"]').fill(email);
  if (bypassMax) await form.locator('[name="quantity"]').evaluate((el) => el.removeAttribute("max"));
  await form.locator('[name="quantity"]').fill(String(qty));
  if (tick) await form.locator('[name="agreed"]').check();
  else await form.locator('[name="agreed"]').evaluate((el) => el.removeAttribute("required"));
  await form.getByRole("button", { name: /record the sale/i }).click();
  await p.waitForTimeout(1800);
  return result(p);
}

// ------------------------------------------------------------ the form
await m.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
const section = await m.locator("[data-in-store-sale]").innerText().catch(() => "");
check("MANAGER sees Record an in-store sale on the drop", /record an in-store sale/i.test(section));
check("with the agreement to tick, in the client's words",
  (await m.locator("[data-in-store-sale] form").innerText()).includes(ACK));

// On a phone, which is how it will be used at the counter.
{
  mkdirSync(join(ARTIFACTS, "instore"), { recursive: true });
  const phone = await managerPage(b, { viewport: { width: 390, height: 844 } });
  await phone.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
  await phone.locator("[data-in-store-sale]").scrollIntoViewIfNeeded();
  await phone.locator("[data-in-store-sale]").screenshot({ path: join(ARTIFACTS, "instore", "form-phone.png") });
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("on a phone the form fits the screen", overflow <= 0, `${overflow}px wider`);
  await phone.context().close();
}

// Not ticked: the browser stops it, and so does the server if the
// browser is bypassed.
const unticked = await record(m, { first: "Walk", last: "Inbuyer", phone: "915-555-0101", qty: 1, tick: false });
check("without the agreement ticked, the server refuses", /tick the box/i.test(unticked), unticked);
check("and nothing was sold", !(await dump()).game_spots.some((s) => s.game_id === GAME && s.status === "sold"));

// ------------------------------------------------------------ a sale
const first = await record(m, {
  first: "Walk", last: "Inbuyer", phone: "915-555-0101", email: "walk.in@example.com", qty: 2,
});
check("MANAGER records 2 guides: told the numbers, the order and that the guide was emailed",
  /guides 1, 2 for Walk Inbuyer, order MLF-S-/.test(first) && /emailed to walk\.in@example\.com/.test(first), first);
let d = await dump();
const order = d.orders.find((o) => o.source === "in_store" && o.first_name === "Walk");
check("an in-store order exists, recorded by the manager, with the agreement stored",
  order?.recorded_by_name === "Luis Ortega" && order?.game_terms_text === ACK && order?.gateway === "in_store",
  JSON.stringify({ by: order?.recorded_by_name, gw: order?.gateway }));
check("guides 1 and 2 are sold to it",
  d.game_spots.filter((s) => s.game_id === GAME && s.order_id === order?.id).map((s) => s.spot_number).join(",") === "1,2");
check("no card was charged: nothing reached the payment gateway",
  d.charges.length === 0, `${d.charges.length} charges`);

const mail = d.emails.find((e) => e.to === "walk.in@example.com");
const mailText = String(mail?.text ?? "");
check("the buyer was emailed", Boolean(mail), mail ? mail.subject : "NO EMAIL");
check("with their guide numbers and a link to their guide",
  /Guide numbers 1, 2/.test(mailText) && /\/guide\/MLF-S-[A-Z0-9]+\.pdf\?t=/.test(mailText),
  mailText.split("\n").filter((l) => /guide/i.test(l)).slice(0, 3).join(" | "));
check("saying it was paid at the shop, with no card or totals",
  /Paid at the shop counter/.test(mailText) && !/TOTAL|ending \d{4}/.test(mailText));
const link = mailText.match(/https?:\/\/\S+\/guide\/\S+/)?.[0];
if (link) {
  const res = await m.request.get(link.replace(/^https?:\/\/[^/]+/, APP));
  check("and the guide link opens the PDF", res.status() === 200 && /pdf/.test(res.headers()["content-type"] ?? ""),
    `${res.status()} ${res.headers()["content-type"]}`);
}

// No email: still recorded, nothing sent.
const second = await record(m, { first: "Cash", last: "Only", phone: "915-555-0102", qty: 1 });
check("a sale with no email is recorded (guide 3)", /guide 3 for Cash Only/.test(second), second);
check("and no email was attempted", !(await dump()).emails.some((e) => /Cash/.test(String(e.text ?? ""))));

// Too many. The form will not submit more than are available...
await record(m, { first: "Too", last: "Many", phone: "915-555-0103", qty: 3 });
check("the form will not submit more guides than are available",
  (await dump()).orders.filter((o) => o.source === "in_store").length === 2);
// ...and if it is made to, the database refuses.
const tooMany = await record(m, { first: "Too", last: "Many", phone: "915-555-0103", qty: 3, bypassMax: true });
check("asking for 3 with 2 left is refused, and says how many are left",
  /3 guides were requested, but only 2 are available/.test(tooMany) && /Nothing was recorded/.test(tooMany), tooMany);

// ------------------------------------------ where the shop will see it
await m.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
const ledger = await m.locator("section").filter({ hasText: /guides sold/i }).first().innerText();
check("the ledger marks the counter sales as in store",
  (await m.locator("[data-in-store]").count()) >= 3 && /Walk Inbuyer/.test(ledger), `${await m.locator("[data-in-store]").count()} marked`);
const list = await m.locator("[data-in-store-sale]").innerText();
check("the drop page lists both in-store sales with who recorded them",
  (list.match(/Recorded .*? by Luis Ortega/gi) ?? []).length === 2, list.replace(/\s+/g, " ").slice(0, 200));

await m.goto(`${APP}/admin/orders`, { waitUntil: "networkidle" });
const orders = await pageText(m);
check("the orders list marks them in store, paid at the register, recorded by the manager",
  (await m.locator("[data-in-store]").count()) === 2 && /paid at the register · recorded by Luis Ortega/i.test(orders),
  orders.slice(0, 200));

const owner = await adminPage(b, { viewport: { width: 1280, height: 1400 } });
await owner.goto(`${APP}/admin/activity`, { waitUntil: "networkidle" });
const log = await pageText(owner);
check("the activity log says who recorded each sale, and what",
  /Luis Ortega.*recorded an in-store sale on September Rifle Game: 2 guides \(1, 2\) to Walk Inbuyer/i.test(log),
  (log.match(/.{0,40}in-store sale.{0,80}/i) ?? ["NOT LOGGED"])[0]);

// The public page counts them as gone.
await owner.goto(`${APP}/featured`, { waitUntil: "networkidle" });
check("the public drop page shows 2 of 5 left", /2\s+(of 5\s+)?(guides\s+)?left/i.test(await pageText(owner)),
  ((await pageText(owner)).match(/.{0,30}left.{0,30}/i) ?? ["?"])[0]);

// ------------------------------------------------------------- voiding
await m.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
const mVoid = m.locator("[data-in-store-row] button", { hasText: /void/i }).first();
check("MANAGER sees Void greyed out, with the owner-only line",
  (await mVoid.isDisabled()) && /owner only/i.test(await m.locator("[data-in-store-sale]").innerText()));

await owner.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
const cashRow = owner.locator("[data-in-store-row]").filter({ hasText: "Cash Only" });
await cashRow.getByRole("button", { name: /^void$/i }).click();
await cashRow.getByRole("button", { name: /void the sale/i }).click();
await owner.waitForTimeout(1800);
const voided = await cashRow.locator("[data-void-result]").innerText().catch(() => "");
check("OWNER voids the sale and is told its guide is available again", /1 guide is available again/.test(voided), voided);
d = await dump();
check("guide 3 is available, with no buyer on it",
  d.game_spots.some((s) => s.game_id === GAME && s.spot_number === 3 && s.status === "open" && !s.order_id && !s.first_name));
await owner.goto(`${APP}/admin/activity`, { waitUntil: "networkidle" });
check("the void is in the log, by the owner",
  /Rey Marquez.*voided in-store sale MLF-S-[A-Z0-9]+ on September Rifle Game \(Cash Only, guide 3 back on sale\)/i.test(await pageText(owner)),
  ((await pageText(owner)).match(/.{0,40}voided.{0,80}/i) ?? ["NOT LOGGED"])[0]);
await owner.goto(`${APP}/admin/orders`, { waitUntil: "networkidle" });
check("the orders list shows it voided, by whom", /Voided .* by Rey Marquez/i.test(await pageText(owner)));

// ------------------------------------ in the drawing like anybody else
const fill = await record(m, { first: "Last", last: "Three", phone: "915-555-0104", qty: 3 });
check("selling the last 3 fills the drop", /guides 3, 4, 5 for Last Three/.test(fill), fill);
check("which is now closed to further sales",
  /sold out/i.test(await m.locator("[data-in-store-closed]").innerText().catch(() => "")));

const stage = await adminPage(b, { viewport: { width: 540, height: 960 } });
await stage.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
await stage.getByRole("button", { name: /start the draw/i }).click();
const { rows } = await throughRoster(stage, { spin: false });
const roster = rows.map((r) => r.replace(/\s+/g, " "));
check("the roster names the in-store buyers, like online ones (they agreed at the counter)",
  roster.some((r) => /Walk I\. 2 guides/.test(r)) && roster.some((r) => /Last T\. 3 guides/.test(r)) &&
    !roster.some((r) => /Holder of guide/.test(r)),
  roster.join(" | "));
check("and the total matches the 5 sold",
  /2 buyers · 5 guides · all 5 sold/.test((await stage.locator("[data-roster-total]").innerText()).replace(/\s+/g, " ")));
await stage.getByRole("button", { name: /spin the wheel/i }).click();
await stage.waitForTimeout(9500);
const wedges = await stage.locator("[data-wedge]").evaluateAll((els) => els.map((e) => e.getAttribute("data-name")));
check("the wheel has one wedge per buyer, by name", wedges.length === 2 && wedges.includes("Walk I.") && wedges.includes("Last T."),
  wedges.join(", "));
note(`drawn: ${await stage.locator("[data-readout]").innerText()}`);

// Once drawn, no void is offered.
await owner.goto(`${APP}/admin/games/${GAME}`, { waitUntil: "networkidle" });
const afterDraw = await owner.locator("[data-in-store-sale]").innerText();
check("after the draw, Void is gone and the rows say why",
  (await owner.locator("[data-in-store-row] button", { hasText: /^void$/i }).count()) === 0 &&
    /Drawn, cannot be voided/i.test(afterDraw), afterDraw.replace(/\s+/g, " ").slice(0, 160));

await b.close();
report();
