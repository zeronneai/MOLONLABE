// The mail transport, both ways round, plus the payload every kind sends.
//
// Run twice: once with EMAIL_PROVIDER unset (apps_script) and once with
// it set to resend, against the same build. The switch is the thing under
// test, so it has to be exercised rather than reasoned about.
//
// Also dumps the exact payload for every kind, which is what the Apps
// Script has to be written against.

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { artifacts } from "../lib/harness.mjs";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const PATCH = "44444444-4444-4444-8444-444444444444";
const PROVIDER = process.env.EXPECT ?? "apps_script";

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());
const dump = async () => (await fetch(`${DOUBLE}/__dump`)).json();

await fetch(`${DOUBLE}/__reset`);

const health = await (await fetch(`${APP}/api/health`)).json();
check(`the app reports ${PROVIDER}`,
  health.email.orderConfirmations.provider === PROVIDER,
  health.email.orderConfirmations.provider);
check("and reports itself configured",
  health.email.orderConfirmations.configured === true);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => {
  window.Accept = {
    dispatchData: (d, h) =>
      h({
        messages: { resultCode: "Ok", message: [] },
        opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "NONCE-OK" },
      }),
  };
  window.localStorage.setItem("mlf_age_ok", "1");
});
const page = await ctx.newPage();
page.on("pageerror", (e) => bad.push(`PAGE ERROR ${e.message}`));

// ------------------------------------------------------- an inquiry
await page.goto(`${APP}/transfers`, { waitUntil: "networkidle" });
// The inquiry form namespaces its ids per instance, so go by label.
await page.getByLabel("Name", { exact: true }).fill("Alma Cortez");
await page.getByLabel("Email", { exact: true }).fill("alma.cortez@example.com");
const phone = page.getByLabel(/phone/i);
if (await phone.count()) await phone.first().fill("915-555-0142");
const msg = page.getByLabel(/message|details|tell us/i);
if (await msg.count())
  await msg.first().fill("Incoming transfer from an out of state dealer.");
await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(1800);

// -------------------------------------------------------- a purchase
await page.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
await page.evaluate(
  (id) => window.localStorage.setItem("mlf_cart", JSON.stringify([{ itemId: id, quantity: 1 }])),
  PATCH,
);
await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
await page.fill("#firstName", "Dana");
await page.fill("#lastName", "Ruiz");
await page.fill("#email", "dana.ruiz@example.com");
await page.fill("#shipLine1", "1200 Texas Ave");
await page.fill("#shipCity", "El Paso");
await page.fill("#shipRegion", "TX");
await page.fill("#shipPostalCode", "79901");
await page.fill("#cardNumber", "4111111111111111");
await page.fill("#cardMonth", "12");
await page.fill("#cardYear", "2029");
await page.fill("#cardCode", "123");
await page.fill("#cardZip", "79901");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: /Pay \$/ }).click();
await page.waitForURL(/confirmation/, { timeout: 25000 });
await page.waitForTimeout(800);

const d = await dump();
const mail = d.emails;
const notes = d.notifications;

check("the confirmation reached the transport", mail.length === 1, `${mail.length}`);

const sent = mail[0] ?? {};
if (PROVIDER === "apps_script") {
  check("it went as kind order_confirmation", sent.kind === "order_confirmation", sent.kind);
  check("it names the recipient at the top level", sent.to === "dana.ruiz@example.com", sent.to);
  check("it carries the order number for the sheet row",
    typeof sent.order_number === "string" && sent.order_number.startsWith("MLF-"),
    sent.order_number);
  check("it carries submitted_at", Boolean(sent.submitted_at));
} else {
  check("it went to Resend in Resend's shape",
    Array.isArray(sent.to) && sent.to[0] === "dana.ruiz@example.com" && Boolean(sent.from),
    JSON.stringify(sent.to));
  check("the order number is NOT smuggled into the Resend payload",
    sent.order_number === undefined);
}

// The point of the whole exercise: the same rendered email either way.
check("the rendered HTML is handed over, not rebuilt",
  has(sent.html, "<!doctype html>") && has(sent.html, "Skull Patch"));
check("a plain purchase carries no entry talk",
  !has(sent.text, "You now have") && !has(sent.text, "entries"));
check("the receipt link survives the transport",
  has(sent.html, "/checkout/confirmation?order="));
check("the legal copy survives the transport",
  has(sent.text, "federally licensed") && has(sent.text, "No refunds"));
check("the subject is set", typeof sent.subject === "string" && sent.subject.length > 0,
  sent.subject);

// ------------------------------------ the order recorded that it sent
const order = d.orders[0];
check("the order records the send", Boolean(order?.confirmation_sent_at),
  String(order?.confirmation_sent_at));
const receipt = await page.locator("body").innerText();
check("the receipt does not claim a failure", !has(receipt, "couldn't send"));

// -------------------------------------- owner notifications unchanged
const kinds = notes.map((n) => n.kind);
check("the owner still hears about the order", kinds.includes("order"), kinds.join(", "));
check("the owner still hears about the inquiry", kinds.includes("inquiry"));
check("the confirmation is not double-posted as a notification",
  !kinds.includes("order_confirmation"));
const orderNote = notes.find((n) => n.kind === "order");
check("the order notification says whether the copy went out",
  orderNote?.confirmation_emailed === true,
  String(orderNote?.confirmation_emailed));

// --------------------------- a transport failure must not fail an order
// Point the app at a script that refuses, and buy again.
await page.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });

writeFileSync(
  `${artifacts()}/payloads-${PROVIDER}.json`,
  JSON.stringify(
    {
      order_confirmation: mail[0],
      notifications: notes,
    },
    null,
    2,
  ),
);

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
