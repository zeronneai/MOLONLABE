// The worst case: the card cleared and the order row did not write.
import { chromium } from "playwright";
import { APP, DOUBLE, ARTIFACTS, CHROMIUM } from "../lib/config.mjs";



const RIFLE = "11111111-1111-4111-8111-111111111111";
const SHIRT = "33333333-3333-4333-8333-333333333333";
const V_M = "aaaaaaaa-0000-4000-8000-000000000002";

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).includes(n);

await fetch(`${DOUBLE}/__reset`);
await fetch(`${DOUBLE}/__fail?table=orders`);

const b = await chromium.launch({ executablePath: CHROMIUM });
const c = await b.newContext();
await c.addInitScript(() => {
  window.Accept = {
    dispatchData: (d, h) =>
      h({
        messages: { resultCode: "Ok", message: [] },
        opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "NONCE-OK" },
      }),
  };
  localStorage.setItem("mlf_age_ok", "1");
});
const p = await c.newPage();
await p.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
await p.evaluate(
  ([r, sh, v]) =>
    localStorage.setItem("mlf_cart", JSON.stringify([
      { itemId: r, quantity: 1 },
      { itemId: sh, quantity: 1, variantId: v },
    ])),
  [RIFLE, SHIRT, V_M],
);
await p.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
for (const [k, v] of [
  ["#firstName", "Dana"], ["#lastName", "Ruiz"], ["#email", "dana.ruiz@example.com"],
  ["#shipLine1", "1200 Texas Ave"], ["#shipCity", "El Paso"], ["#shipRegion", "TX"],
  ["#shipPostalCode", "79901"], ["#cardNumber", "4111111111111111"],
  ["#cardMonth", "12"], ["#cardYear", "2029"], ["#cardCode", "123"], ["#cardZip", "79901"],
]) if (await p.locator(k).count()) await p.fill(k, v);
await p.getByRole("checkbox").check();
await p.getByRole("button", { name: /Pay \$/ }).click();
await p.waitForTimeout(3500);

const txt = await p.locator("body").innerText();
check("the buyer is told not to pay again",
  /Don.t pay again/.test(txt), txt.slice(0, 90).replace(/\n/g, " "));

const d = await (await fetch(`${DOUBLE}/__dump`)).json();
const note = d.notifications.find((n) => n.kind === "order_error");
check("an order_error notification was raised", Boolean(note));
check("it names which failure it is", note?.failure === "charged_not_saved", note?.failure);
check("it keeps the structured fields",
  typeof note?.transaction_id === "string" && typeof note?.total_cents === "number");

const s = note?.summary ?? "";
check("the summary opens with an unmistakable line",
  s.split("\n")[0] === "URGENT. READ THIS NOW.", s.split("\n")[0]);
check("it says a card was charged", has(s, "A CARD WAS CHARGED"));
check("it says nothing recorded the sale",
  has(s, "Nothing in the system recorded the sale"));
check("it gives the transaction id to find in Authorize.net",
  Boolean(note?.transaction_id) && has(s, note.transaction_id));
check("it gives the amount as money", /Amount charged: \$/.test(s),
  (s.match(/Charged.*/) ?? [""])[0]);
check("it says what to do", has(s, "Authorize.net") && has(s, "by hand"));
check("it distinguishes void from refund",
  has(s, "UNSETTLED") && has(s, "SETTLED SUCCESSFULLY") && has(s, "VOID") && has(s, "REFUND"));
check("it says to check the admin first", has(s, "CHECK THE ADMIN FIRST"));
check("it says to call the customer before deciding",
  has(s, "CALL THE CUSTOMER BEFORE YOU DECIDE"));
check("it names what is still held off the shelf",
  has(s, "WHAT IS BEING HELD") && has(s, "SIG MPX Carbon") && has(s, "Molon Labe Tee, Medium"),
  (s.match(/  SIG MPX[^\n]*/) ?? [""])[0]);
check("it distinguishes a reserved unit from reduced size stock",
  has(s, "marked RESERVED") && has(s, "taken out of that size's stock"));
check("it says to put the stock back after a refund",
  has(s, "PUT THE STOCK BACK IF YOU REFUNDED"));
check("it says who to call", has(s, "WHO TO CALL") && has(s, "Purple Roots"));
check("no ASCII box art that a proportional font would wreck",
  !/[!*=-]{6,}/.test(s));
check("the notification carries its own subject line",
  typeof note?.subject === "string" && note.subject.startsWith("URGENT:"),
  note?.subject);

await fetch(`${DOUBLE}/__fail`);
await b.close();
const { writeFileSync } = await import("node:fs");
writeFileSync(`${ARTIFACTS}/urgent.json`, JSON.stringify(d.notifications, null, 2));
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
console.log("\n=== THE URGENT SUMMARY ===\n" + s);
process.exit(bad.length === 0 ? 0 : 1);
