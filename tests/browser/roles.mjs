// Owner and manager, through the real admin.
//
// tests/db/roles.mjs proves the DATABASE refuses a manager. This proves
// the other two things that have to be true for the month the manager
// runs the shop:
//
//   1. What he sees. Everything he cannot do is on screen, disabled, with
//      the line saying it is the owner's. Nothing he needs is missing.
//   2. That the SERVER refuses him on its own. The test double has no row
//      level security at all, so when a restricted action is forced past
//      the disabled control here, the only thing that can stop it is the
//      server action's own check. If that check were missing, the double
//      would happily do what it was told and these assertions would fail.
//
// And for the owner: the log names people from the staff table, filters
// by person, and alerts go where Team & alerts says.

import { APP, DOUBLE } from "../lib/config.mjs";
import {
  adminPage,
  browser,
  dump,
  insert,
  managerPage,
  reset,
  strangerPage,
  suite,
} from "../lib/harness.mjs";

const { check, note, report } = suite();

const SHIRT = "33333333-3333-4333-8333-333333333333";
const GAME = "55555555-5555-4555-8555-555555555555";
const V_M = "aaaaaaaa-0000-4000-8000-000000000002";
const MANAGER_ID = "7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const OWNER_ONLY = "Owner only. Ask the owner if this needs changing.";

const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());
const text = async (p) => p.locator("body").innerText();
const visit = async (p, path) => {
  await p.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(300);
  return text(p);
};
/** Strips `disabled` from everything under `selector`, as a tampered client would. */
const force = (p, selector) =>
  p.locator(selector).evaluateAll((roots) => {
    let n = 0;
    for (const root of roots) {
      for (const el of [root, ...root.querySelectorAll("[disabled], [aria-disabled]")]) {
        if (el.hasAttribute("disabled")) n += 1;
        el.removeAttribute("disabled");
        el.removeAttribute("aria-disabled");
        // React reads the property, not only the attribute.
        el.disabled = false;
      }
    }
    return n;
  });
/**
 * Runs a disabled button's own click handler.
 *
 * Removing `disabled` from the DOM is not enough for a button: React
 * checks the prop, not the attribute, and drops the click. A tampered
 * client can still call the handler, and so does this, which is the
 * honest way to prove the server action behind it refuses on its own.
 */
const invoke = (locator) =>
  locator.evaluate((el) => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps"));
    el[key].onClick({ preventDefault() {}, stopPropagation() {} });
  });
const setting = async (key) => (await dump()).settings.find((s) => s.key === key)?.value;

await reset();
const b = await browser();
const errors = [];

// ====================================================================
// THE MANAGER
// ====================================================================
const m = await managerPage(b, { viewport: { width: 1280, height: 1200 } });
m.on("pageerror", (e) => errors.push(e.message));

let t = await visit(m, "/admin/inventory");
check("MANAGER signs in and lands on the inventory", has(t, "What you sell"),
  t.slice(0, 80).replace(/\n/g, " "));
check("the header says who and as what",
  has(await m.locator("[data-signed-in-as]").innerText(), "Luis Ortega · Manager"),
  await m.locator("[data-signed-in-as]").innerText());

// ---------------------------------------------------- what he can do
t = await visit(m, `/admin/inventory/${SHIRT}`);
await m.fill("#f-price-cents", "36.00");
await m.fill("#f-long", "Heavyweight cotton, printed in El Paso.");
await m.click('form button[type="submit"]:has-text("Save")');
await m.waitForTimeout(2500);

let d = await dump();
const shirt = d.items.find((r) => r.id === SHIRT);
check("MANAGER can change a price", shirt.price_cents === 3600, String(shirt.price_cents));
check("MANAGER can change a description", has(shirt.long_desc, "printed in El Paso"));
check("the edit carries his name from the staff table", shirt.updated_by_name === "Luis Ortega",
  shirt.updated_by_name);
const mine = d.admin_activity.filter((r) => r.actor_id === MANAGER_ID);
check("the price change is logged as his",
  mine.some((r) => r.action === "price" && r.actor_name === "Luis Ortega"),
  mine.map((r) => `${r.action}:${r.field}`).join(", "));
check("so is the plain description edit, which used to log nothing",
  mine.some((r) => r.field === "details" && has(r.after_value, "description")),
  JSON.stringify(mine.find((r) => r.field === "details")?.after_value));
check("no log line anywhere carries the name he gave himself in metadata",
  !JSON.stringify(d.admin_activity).includes("The Real Owner") &&
    !JSON.stringify(d.items).includes("The Real Owner"));

// Stock, through the same form. The size rows are inputs in the form.
t = await visit(m, `/admin/inventory/${SHIRT}`);
const stockInputs = m.locator('input[aria-label="Stock for Medium"]');
if ((await stockInputs.count()) > 0) {
  await stockInputs.fill("7");
  await m.click('form button[type="submit"]:has-text("Save")');
  await m.waitForTimeout(2500);
  d = await dump();
  check("MANAGER can change stock",
    d.item_variants.find((v) => v.id === V_M)?.stock === 7,
    String(d.item_variants.find((v) => v.id === V_M)?.stock));
  const stockLine = d.admin_activity.find((r) => r.action === "stock");
  check("and the stock change is logged with before and after",
    stockLine?.actor_name === "Luis Ortega" && stockLine?.before_value?.Medium === 1 &&
      stockLine?.after_value?.Medium === 7,
    JSON.stringify([stockLine?.before_value, stockLine?.after_value]));
} else {
  check("the size editor has stock inputs this suite can find", false,
    "selector found nothing; the stock assertions did not run");
}

// Deleting: visible, disabled, explained. Tried on an item of its own,
// so that if the server did let it through, the rest of this suite
// still has its shirt to work with and reports the failure by name.
const CAP = "dddddddd-0000-4000-8000-000000000001";
await insert("items", {
  id: CAP, slug: "throwaway-cap", name: "Throwaway Cap", category: "apparel",
  price_cents: 1500, fulfillment_type: "ship", status: "available", images: [], specs: {},
  has_variants: false, is_featured: false, sort_order: 9,
});
t = await visit(m, `/admin/inventory/${CAP}`);
const del = m.getByRole("button", { name: "Delete this item" });
check("MANAGER sees Delete, disabled", (await del.count()) === 1 && (await del.isDisabled()));
check("with the owner-only line", has(t, OWNER_ONLY));

// ...and forced, the SERVER refuses. The double would delete it.
await invoke(del);
await m.waitForTimeout(300);
await m.getByRole("button", { name: "Delete", exact: true }).click();
await m.waitForTimeout(2000);
d = await dump();
check("forced, the server refuses the delete",
  d.items.some((r) => r.id === CAP),
  d.items.some((r) => r.id === CAP) ? "the item is still there" : "the item is gone");
check("and says why in the same words", has(await text(m), OWNER_ONLY));

// Archive is his.
await visit(m, "/admin/inventory");
// The smallest element holding both the name and an Archive button is
// that item's card; `.last()` of the matching divs is the innermost.
const card = m
  .locator("div")
  .filter({ hasText: "MOLON LABE TEE" })
  .filter({ has: m.getByRole("button", { name: "Archive" }) })
  .last();
await card.getByRole("button", { name: "Archive" }).click();
await m.waitForTimeout(2000);
d = await dump();
check("MANAGER can archive", d.items.find((r) => r.id === SHIRT)?.status === "hidden",
  d.items.find((r) => r.id === SHIRT)?.status);
await fetch(`${DOUBLE}/rest/v1/items?id=eq.${SHIRT}`, {
  method: "PATCH", headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "available" }),
});

// Inquiries.
await insert("inquiries", {
  id: "cccccccc-0000-4000-8000-000000000001", type: "transfer", name: "Tom Reyes",
  email: "tom@example.com", phone: "9155550199", message: "Transfer from Arizona",
  status: "new", created_at: new Date().toISOString(),
});
t = await visit(m, "/admin/inquiries");
check("MANAGER sees transfer requests", has(t, "Tom Reyes"));
await m.getByRole("group", { name: "Inquiry status" }).getByRole("button", { name: "contacted" }).first().click();
await m.waitForTimeout(1500);
d = await dump();
check("MANAGER can mark one contacted",
  d.inquiries[0]?.status === "contacted", d.inquiries[0]?.status);
check("and that is logged as his",
  d.admin_activity.some((r) => r.entity === "inquiry" && r.actor_name === "Luis Ortega"));

// A game, created by the manager, through create_game.
t = await visit(m, "/admin/games/new");
await m.fill('[name="title"]', "October Pistol Game");
await m.fill('[name="total_spots"]', "40");
await m.fill('[name="spot_price"]', "25");
const words = "Carried daily for years without a single failure to feed on any ammunition I have run through it.";
for (const k of ["guide_why", "guide_care", "guide_pairs"]) await m.fill(`[name="${k}"]`, words);
await m.click('button[type="submit"]');
await m.waitForTimeout(2500);
d = await dump();
const made = d.games.find((g) => g.title === "October Pistol Game");
check("MANAGER can create a game", Boolean(made));
check("with every spot laid out",
  d.game_spots.filter((s) => s.game_id === made?.id).length === 40,
  String(d.game_spots.filter((s) => s.game_id === made?.id).length));
check("created in his name", made?.created_by_name === "Luis Ortega", made?.created_by_name);

// The draw and the winner's contact details.
for (const s of d.game_spots.filter((x) => x.game_id === GAME)) {
  await fetch(`${DOUBLE}/rest/v1/game_spots?id=eq.${s.id}`, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "sold", first_name: "Ana", last_name: `Lopez${s.spot_number}`,
      email: `ana${s.spot_number}@example.com`, phone: `915555010${s.spot_number}`,
      sold_at: new Date().toISOString(),
    }),
  });
}
t = await visit(m, `/admin/games/${GAME}`);
const drawBtn = m.getByRole("button", { name: /draw/i }).first();
await drawBtn.click();
await m.waitForTimeout(800);
const confirm = m.getByRole("dialog").getByRole("button", { name: /draw/i }).first();
if (await confirm.count()) await confirm.click();
await m.waitForTimeout(3000);
d = await dump();
const won = d.winners.find((w) => w.game_id === GAME);
check("MANAGER can run the draw", Boolean(won), d.winners.length ? "" : "no winner row");
t = await visit(m, `/admin/games/${GAME}`);
const spot = d.game_spots.find((s) => s.id === won?.spot_id);
const contact = await m.locator("[data-winner-contact]").innerText().catch(() => "");
check("and sees the winner's email and phone to notify them",
  Boolean(spot) && has(contact, spot.email) && has(contact, spot.phone),
  contact.replace(/\n/g, " ").slice(0, 120));
const presentation = await m.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
check("MANAGER can open the presentation", presentation?.status() === 200,
  String(presentation?.status()));

// ------------------------------------------- what he cannot, on screen
t = await visit(m, "/admin/games");
check("the spot export shows as owner only on the games list", has(t, "CSV · owner only"));
const csv = await m.request.get(`${APP}/admin/games/${GAME}/spots.csv`);
check("and the export itself is refused by the server",
  csv.status() === 403 && has(await csv.text(), OWNER_ONLY), `${csv.status()}`);

t = await visit(m, "/admin/commerce");
check("Tax & Shipping shows its values to him", has(t, "8.25"));
check("with the owner-only line", has(t, OWNER_ONLY));
check("and every field disabled",
  await m.locator("#tax").isDisabled() && await m.locator("#standard").isDisabled());
await force(m, "form");
await m.fill("#tax", "0");
await m.fill("#standard", "0.01");
await m.getByRole("button", { name: "Save" }).click();
await m.waitForTimeout(1500);
let commerce = await setting("commerce");
check("forced, the server refuses a tax change", commerce.tax_rate_bps === 825,
  String(commerce.tax_rate_bps));
check("and a postage change", commerce.shipping_standard_cents === 1000,
  String(commerce.shipping_standard_cents));
check("and tells him why", has(await text(m), OWNER_ONLY));

t = await visit(m, "/admin/game");
const sw = m.getByRole("button", { name: /Offer is/ });
check("the offer switch is there, disabled", await sw.isDisabled());
check("with the owner-only line", has(t, OWNER_ONLY));
await invoke(sw);
await m.waitForTimeout(1500);
check("forced, the server refuses to switch the offer",
  (await setting("game_offer")).enabled === true);
check("and says so on screen", has(await text(m), OWNER_ONLY));
await visit(m, "/admin/game");
await force(m, "form");
await m.fill("#g-code", "FREEGUN");
await m.getByRole("button", { name: "Save reward" }).click();
await m.waitForTimeout(1500);
check("forced, the server refuses a new discount code",
  (await setting("game_offer")).code === "MOLON10", (await setting("game_offer")).code);
await visit(m, "/admin/game");
await force(m, "form");
await m.fill("#desktop-targets", "1");
await m.getByRole("button", { name: "Save desktop" }).click();
await m.waitForTimeout(1500);
check("forced, the server refuses a difficulty change",
  (await setting("game_difficulty")).desktop.targetCount === 3);

t = await visit(m, "/admin/games");
const demo = m.getByRole("button", { name: /demo game/i });
if (await demo.count()) {
  check("the demo game button is disabled for him", await demo.first().isDisabled());
  await invoke(demo.first());
  await m.waitForTimeout(1500);
  check("forced, the server refuses to create it",
    !(await dump()).games.some((g) => g.title.startsWith("[DEMO]")));
}

t = await visit(m, "/admin/activity");
check("the activity page tells him it is the owner's",
  has(t, OWNER_ONLY) && (await m.locator("[data-activity]").count()) === 0);
check("rather than claiming nothing has happened", !has(t, "Nothing recorded yet"));

t = await visit(m, "/admin/team");
check("Team & alerts is owner only for him", has(t, OWNER_ONLY));
check("and does not list the team", (await m.locator("[data-team-member]").count()) === 0);
check("the recipient lists are disabled", await m.locator("#alerts-problems").isDisabled());
await force(m, "main");
await m.fill("#alerts-problems", "someone@example.com");
await m.getByRole("button", { name: "Save recipients" }).click();
await m.waitForTimeout(1500);
check("forced, the server refuses to change recipients",
  (await setting("alert_routing")) === undefined, JSON.stringify(await setting("alert_routing")));

// Every owner-only screen he can reach, every one of them saying why.
check("no page error on any manager screen", errors.length === 0, errors.join(" | "));

// ====================================================================
// THE OWNER
// ====================================================================
const o = await adminPage(b, { viewport: { width: 1280, height: 1200 } });
o.on("pageerror", (e) => errors.push(e.message));

t = await visit(o, "/admin/activity");
check("OWNER sees the log", (await o.locator("[data-activity]").count()) > 0);
check("with a filter for each person",
  has(await o.getByRole("navigation", { name: "Filter by person" }).innerText(), "Luis Ortega"));
t = await visit(o, `/admin/activity?who=${MANAGER_ID}`);
const lines = await o.locator("[data-activity]").allInnerTexts();
check("filtered to the manager, every line is his",
  lines.length > 0 && lines.every((l) => l.startsWith("Luis Ortega")),
  `${lines.length} lines; first: ${lines[0]?.split("\n")[0]}`);
check("and it reads as sentences, stock included",
  lines.some((l) => /Medium 1 → 7/.test(l)) || lines.some((l) => has(l, "sizes or stock")),
  lines.find((l) => has(l, "stock"))?.split("\n")[0]);

t = await visit(o, "/admin/team");
check("OWNER sees the team with roles",
  (await o.locator("[data-team-member]").count()) === 2 && has(t, "Manager"));
await o.fill("#alerts-problems", "luis@example.com, rey@example.com");
await o.getByRole("button", { name: "Save recipients" }).click();
await o.waitForTimeout(1500);
const routing = await setting("alert_routing");
check("OWNER can set who gets problem alerts",
  JSON.stringify(routing?.problems) === JSON.stringify(["luis@example.com", "rey@example.com"]),
  JSON.stringify(routing));

const before = (await dump()).notifications.length;
await o.locator("form:has(input[name='group'][value='problems'])").getByRole("button").click();
await o.waitForTimeout(2000);
const sent = (await dump()).notifications.slice(before);
const test = sent.find((n) => n.kind === "test_alert");
check("the test alert went through the script", Boolean(test));
check("addressed to the problems list",
  JSON.stringify(test?.notify_to) === JSON.stringify(["luis@example.com", "rey@example.com"]),
  JSON.stringify(test?.notify_to));
check("and the owner is told who the script says it reached",
  has(await text(o), "The script says it went to luis@example.com, rey@example.com"));

// A real problem alert follows the same list. The worst case, forced.
await fetch(`${DOUBLE}/__fail?table=orders`);
const buyer = await b.newContext();
await buyer.addInitScript(() => {
  window.Accept = {
    dispatchData: (_d, h) => h({
      messages: { resultCode: "Ok", message: [] },
      opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "NONCE-OK" },
    }),
  };
  localStorage.setItem("mlf_age_ok", "1");
});
const bp = await buyer.newPage();
await bp.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
await bp.evaluate(([sh, v]) => localStorage.setItem("mlf_cart",
  JSON.stringify([{ itemId: sh, quantity: 1, variantId: v }])), [SHIRT, V_M]);
await bp.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
for (const [k, v] of [
  ["#firstName", "Dana"], ["#lastName", "Ruiz"], ["#email", "dana.ruiz@example.com"],
  ["#shipLine1", "1200 Texas Ave"], ["#shipCity", "El Paso"], ["#shipRegion", "TX"],
  ["#shipPostalCode", "79901"], ["#cardNumber", "4111111111111111"],
  ["#cardMonth", "12"], ["#cardYear", "2029"], ["#cardCode", "123"], ["#cardZip", "79901"],
]) if (await bp.locator(k).count()) await bp.fill(k, v);
await bp.getByRole("checkbox").check();
await bp.getByRole("button", { name: /Pay \$/ }).click();
await bp.waitForTimeout(4000);
await fetch(`${DOUBLE}/__fail`);
const problem = (await dump()).notifications.find((n) => n.kind === "order_error");
check("a real order_error reaches the problems list, manager included",
  problem?.notify_group === "problems" &&
    JSON.stringify(problem?.notify_to) === JSON.stringify(["luis@example.com", "rey@example.com"]),
  JSON.stringify({ group: problem?.notify_group, to: problem?.notify_to }));

// An empty list sends the payload the script has always had.
const before2 = (await dump()).notifications.length;
await o.goto(`${APP}/admin/team`, { waitUntil: "networkidle" });
await o.locator("form:has(input[name='group'][value='routine'])").getByRole("button").click();
await o.waitForTimeout(2000);
const routine = (await dump()).notifications.slice(before2).find((n) => n.kind === "test_alert");
check("with no routine list set, a routine alert carries no notify_to",
  Boolean(routine) && !("notify_to" in routine), JSON.stringify(routine?.notify_to));
check("and the owner is told it went to the script's usual address",
  has(await text(o), "went to owner@molonlabe.example"));
check("the draw's log line names the game",
  (await dump()).admin_activity.some((r) => r.action === "draw" && r.entity_label === "September Rifle Game"));

const ownerCsv = await o.request.get(`${APP}/admin/games/${GAME}/spots.csv`);
check("OWNER can still export the spot list", ownerCsv.status() === 200 &&
  has(await ownerCsv.text(), "ana1@example.com"), String(ownerCsv.status()));

// ====================================================================
// AN ACCOUNT WITH NO ROLE
// ====================================================================
const s = await strangerPage(b, { viewport: { width: 1280, height: 900 } });
t = await visit(s, "/admin/inventory");
check("a signed-in account with no role is told it has no access", has(t, "No access"));
check("and sees no admin at all",
  !has(t, "What you sell") && !has(t, "SIG MPX") && !has(t, "Tax & Shipping"));
const guide = await s.request.get(`${APP}/admin/games/${GAME}/guide.pdf`);
check("the guide preview, which uses the service role, refuses it",
  guide.status() === 403, String(guide.status()));
const draw = await s.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
check("so does the draw presentation", draw?.status() === 404, String(draw?.status()));

note("RLS itself is proven in tests/db/roles.mjs; the double has none, so every refusal here is the server's own");
await b.close();
report();
