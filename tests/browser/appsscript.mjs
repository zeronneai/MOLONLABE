// The Apps Script in docs/apps-script/Code.gs, run against what the site
// actually sends.
//
// The script lives in Google, where nothing here can reach it. What CAN
// be checked is the thing most likely to be wrong: whether the script's
// reading of the payload matches the payload. So the site sends its real
// alerts to the test double through a real checkout, a real sold-out, a
// real failed order and a real form, and each captured payload is fed to
// the script's own doPost, running in Node with stand-ins for Gmail,
// Sheets and ContentService that record what it did.
//
// What this cannot tell you: that Gmail delivers, that the account has
// the alias, or what your existing sheet's columns are called. Run
// setupCheck() once in the editor for the first two.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { APP, DOUBLE, ROOT } from "../lib/config.mjs";
import { browser, dump, insert, page as newPage, reset, suite } from "../lib/harness.mjs";

const { check, note, report } = suite();
const SCRIPT = readFileSync(join(ROOT, "docs/apps-script/Code.gs"), "utf8");
const PROBLEMS = ["luis@example.com", "rey@example.com"];

// ------------------------------------------------ Google, recorded
function google({ aliases = [] } = {}) {
  const sent = [];
  const tabs = {};
  const sheet = (name) => {
    const rows = [];
    return {
      name, rows,
      getLastColumn: () => (rows[0] ? rows[0].length : 0),
      getRange: (_r, _c, _h, w) => ({
        getValues: () => [rows[0].slice(0, w)],
        setValues: (v) => { rows[0] = v[0].slice(); },
      }),
      appendRow: (r) => rows.push(r),
    };
  };
  const book = {
    getSheetByName: (n) => tabs[n] ?? null,
    insertSheet: (n) => (tabs[n] = sheet(n)),
  };
  const context = {
    GmailApp: {
      sendEmail: (to, subject, body, opts) => sent.push({ to, subject, body, opts }),
      getAliases: () => aliases,
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; }, getContent() { return s; } }),
    },
    console,
  };
  vm.createContext(context);
  vm.runInContext(SCRIPT, context);
  const post = (payload) =>
    JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).content);
  return { post, sent, tabs, context };
}

// ------------------------------------------------ real payloads
await reset();
await insert("settings", { key: "alert_routing", value: { problems: PROBLEMS, routine: [] } });
const b = await browser();
const p = await newPage(b, { viewport: { width: 1280, height: 1200 } });
await p.context().addInitScript(() => {
  window.Accept = {
    dispatchData: (_d, h) => h({
      messages: { resultCode: "Ok", message: [] },
      opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "NONCE-OK" },
    }),
  };
});
async function pay(first) {
  await p.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
  for (const [k, v] of [
    ["#firstName", first], ["#lastName", "Ruiz"], ["#email", "dana.ruiz@example.com"],
    ["#shipLine1", "1200 Texas Ave"], ["#shipCity", "El Paso"], ["#shipRegion", "TX"],
    ["#shipPostalCode", "79901"], ["#cardNumber", "4111111111111111"],
    ["#cardMonth", "12"], ["#cardYear", "2029"], ["#cardCode", "123"], ["#cardZip", "79901"],
  ]) if (await p.locator(k).count()) await p.fill(k, v);
  const boxes = p.getByRole("checkbox");
  for (let i = 0; i < (await boxes.count()); i += 1) await boxes.nth(i).check();
  await p.getByRole("button", { name: /Pay \$/ }).click();
  await p.waitForTimeout(4000);
}

// All five guides: a confirmation, an order alert and a sold-out alert.
await p.goto(`${APP}/featured`, { waitUntil: "networkidle" });
await p.fill("#guide-count", "5");
await p.getByRole("button", { name: /^Get/ }).click();
await p.waitForTimeout(500);
await pay("Dana");

// A card charged and the order not saved: the worst problem alert.
await fetch(`${DOUBLE}/__fail?table=orders`);
await p.evaluate(() => localStorage.setItem("mlf_cart", JSON.stringify([
  { itemId: "33333333-3333-4333-8333-333333333333", quantity: 1,
    variantId: "aaaaaaaa-0000-4000-8000-000000000001" }])));
await pay("Ana");
await fetch(`${DOUBLE}/__fail`);

// A transfer request through the real form.
await p.goto(`${APP}/transfers`, { waitUntil: "networkidle" });
await p.fill('[name="name"]', "Alma Cortez");
await p.fill('[name="email"]', "alma@example.com");
if (await p.locator('[name="phone"]').count()) await p.fill('[name="phone"]', "9155550142");
await p.locator('form button[type="submit"]').first().click();
await p.waitForTimeout(2500);

const d = await dump();
const confirmation = d.emails.find((e) => e.kind === "order_confirmation");
const byKind = (k) => d.notifications.find((n) => n.kind === k);
const order = byKind("order");
const full = byKind("game_full");
const problem = byKind("order_error");
const inquiry = byKind("inquiry");
check("the site sent every kind this test needs",
  Boolean(confirmation && order && full && problem && inquiry),
  ["confirmation", "order", "game_full", "order_error", "inquiry"]
    .filter((_, i) => ![confirmation, order, full, problem, inquiry][i]).join(", ") || "all five");

// ------------------------------------------------ the script, on them
const g = google();

const r1 = g.post(confirmation);
const mail1 = g.sent.at(-1);
check("CONFIRMATION goes to the customer", mail1?.to === "dana.ruiz@example.com", mail1?.to);
check("with the site's HTML as the HTML body, unmodified",
  mail1?.opts?.htmlBody === confirmation.html, `${mail1?.opts?.htmlBody?.length} of ${confirmation.html.length} chars`);
check("and the site's text as the plain body", mail1?.body === confirmation.text);
check("with the site's subject", mail1?.subject === confirmation.subject, mail1?.subject);
check("and the script answers ok", r1.ok === true, JSON.stringify(r1));

const r2 = g.post(problem);
const mail2 = g.sent.at(-1);
check("ORDER PROBLEM goes to the problems list", mail2?.to === PROBLEMS.join(","), mail2?.to);
check("with a subject nobody can mistake",
  mail2?.subject.startsWith("[ORDER PROBLEM] ") && mail2.subject.includes(problem.subject), mail2?.subject);
check("and the site's runbook as the body, unmodified", mail2?.body === problem.summary);
check("and reports who it went to", JSON.stringify(r2.delivered_to) === JSON.stringify(PROBLEMS),
  JSON.stringify(r2));

for (const [label, payload] of [["ORDER", order], ["SOLD OUT", full], ["INQUIRY", inquiry]]) {
  const r = g.post(payload);
  const mail = g.sent.at(-1);
  check(`${label} goes to the routine list, which is empty, so to the default address`,
    mail?.to === "owner@example.com", mail?.to);
  check(`${label} keeps the site's subject, unprefixed`, mail?.subject === payload.subject, mail?.subject);
  check(`${label} reports where it went`, r.delivered_to?.[0] === "owner@example.com", JSON.stringify(r));
}

// A problem with its list empty still reaches somebody.
const bare = { ...problem };
delete bare.notify_to;
g.post(bare);
check("a problem with no list still goes to the default address, marked",
  g.sent.at(-1)?.to === "owner@example.com" && g.sent.at(-1)?.subject.startsWith("[ORDER PROBLEM]"),
  `${g.sent.at(-1)?.to} · ${g.sent.at(-1)?.subject}`);

// The admin's test button, both groups, as the site sends them.
g.post({ kind: "test_alert", group: "routine", requested_by: "Rey", notify_group: "routine",
  subject: "Test alert (routine) — nothing has happened", summary: "TEST" });
check("a routine test is not marked as a problem", !g.sent.at(-1).subject.startsWith("[ORDER PROBLEM]"));

// ------------------------------------------------ the sheet
const orders = g.tabs.Orders?.rows ?? [];
check("an ORDER lands in the Orders tab under named columns",
  orders.length === 2 && orders[0].includes("order_number") && orders[0].includes("total_cents"),
  orders[0]?.slice(0, 8).join(", "));
const col = (tab, name) => tab.rows[0].indexOf(name);
check("with the order number in its column",
  orders[1]?.[col(g.tabs.Orders, "order_number")] === order.order_number);
check("and the old sheet columns still filled",
  String(orders[1]?.[col(g.tabs.Orders, "collects")] ?? "") === (order.collects ?? []).join(", "));
check("the customer's email body is not copied into the sheet",
  !(g.tabs.Confirmations?.rows[0] ?? []).includes("html"));
check("each row records where the email went",
  g.tabs.Problems.rows[1][col(g.tabs.Problems, "delivered_to")] === PROBLEMS.join(", "));

// Staff read this sheet: no heading or cell may carry the old words.
const sheetText = Object.values(g.tabs).flatMap((t) => t.rows.flat()).map(String)
  .filter((cell) => !cell.startsWith("{") || cell.includes("hold")).join("\n");
const stray = sheetText.match(/[^\n]*\bspots?(_\w+)?\b[^\n]*/i);
check("no sheet heading or value says spot", !stray, stray ? stray[0].slice(0, 80) : "clean");
check("the guide numbers have their own column",
  orders[0].includes("guide_numbers") && !orders[0].includes("spot_numbers"), orders[0].join(", ").slice(0, 160));

// An existing tab with its own columns keeps them, in their order.
const g2 = google();
g2.context.SpreadsheetApp.getActiveSpreadsheet().insertSheet("Orders").rows.push(
  ["submitted_at", "order_number", "name", "email", "total_cents", "My own notes"]);
g2.post(order);
const existing = g2.tabs.Orders.rows;
check("an existing tab keeps its columns where they were",
  existing[0].slice(0, 6).join(",") === "submitted_at,order_number,name,email,total_cents,My own notes",
  existing[0].slice(0, 7).join(","));
check("fills them by name", existing[1][1] === order.order_number && existing[1][5] === "");
check("and adds new fields at the end instead of shifting anything",
  existing[0].length > 6 && existing[0].indexOf("delivered_to") > 5);

// A mail failure is reported to the site, and still logged.
const g3 = google();
g3.context.GmailApp.sendEmail = () => { throw new Error("Service invoked too many times for one day: email."); };
const failed = g3.post(confirmation);
check("a Gmail failure answers ok:false with the reason, as the site expects",
  failed.ok === false && /too many times/.test(failed.error), JSON.stringify(failed));
check("and the confirmation is still logged",
  (g3.tabs.Confirmations?.rows.length ?? 0) === 2);

// The alias rule.
const g4 = google({ aliases: ["orders@molonlabe.example"] });
g4.post({ ...confirmation, from: "orders@molonlabe.example" });
check("a verified alias is used as the sender", g4.sent[0].opts.from === "orders@molonlabe.example");
const g5 = google({ aliases: [] });
g5.post({ ...confirmation, from: "orders@molonlabe.example" });
check("an unverified one is ignored rather than failing the send",
  g5.sent.length === 1 && !g5.sent[0].opts.from);

note("Gmail delivery, the alias and your real sheet's column names can only be checked in Google: run setupCheck() once");
await b.close();
report();
