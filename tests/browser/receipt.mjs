// The running entry total and the way back to the receipt.
//
// Two purchases by the same buyer, because the whole point is that the
// second email reports a higher number than the first. Then the link out
// of that email is followed, and the link is aged out to check what an
// expired one does.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP, DOUBLE, CHROMIUM, ROOT } from "../lib/config.mjs";



const SHIRT = "33333333-3333-4333-8333-333333333333";
const PATCH = "44444444-4444-4444-8444-444444444444";
const BUYER = "dana.ruiz@example.com";

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).toLowerCase().includes(String(n).toLowerCase());
const dump = async () => (await fetch(`${DOUBLE}/__dump`)).json();

await fetch(`${DOUBLE}/__reset`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
await ctx.addInitScript(() => {
  window.Accept = {
    dispatchData: (data, handler) =>
      handler({
        messages: { resultCode: "Ok", message: [] },
        opaqueData: {
          dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
          dataValue: "NONCE-OK",
        },
      }),
  };
  window.localStorage.setItem("mlf_age_ok", "1");
});
const page = await ctx.newPage();
page.on("pageerror", (e) => bad.push(`PAGE ERROR ${e.message}`));

// One purchase, start to finish. Returns the confirmation URL it landed on.
async function buy(itemId, variantId) {
  await page.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (l) => window.localStorage.setItem("mlf_cart", JSON.stringify(l)),
    [variantId ? { itemId, quantity: 1, variantId } : { itemId, quantity: 1 }],
  );
  await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
  await page.fill("#firstName", "Dana");
  await page.fill("#lastName", "Ruiz");
  await page.fill("#email", BUYER);
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
  await page.waitForTimeout(600);
  return page.url();
}

// --------------------------------------------- purchase one: the tee, $32
await buy(SHIRT, "aaaaaaaa-0000-4000-8000-000000000001");
let mail = (await dump()).emails;
check("the confirmation email was sent", mail.length === 1, `${mail.length} sent`);

let text = mail[0]?.text ?? "";
let html = mail[0]?.html ?? "";
// Ordinary merchandise earns nothing under the fixed-pool model. The
// spot receipt is covered end to end in spots.mjs.
check("a plain purchase says nothing about entries",
  !has(text, "entries") && !has(text, "You now have"),
  (text.match(/entr[^\n]*/) ?? ["clean"])[0]);

// ------------------------------------------- purchase two: the patch, $12
const secondUrl = await buy(PATCH);
mail = (await dump()).emails;
check("a second email was sent", mail.length === 2, `${mail.length} sent`);
text = mail[1]?.text ?? "";
html = mail[1]?.html ?? "";
check("the second email is also clean of entry talk", !has(text, "entries"));

// ------------------------------------------------- the link back to it
const linkMatch = html.match(/href="(http[^"]*\/checkout\/confirmation[^"]*)"/);
check("the email carries a link to the receipt", Boolean(linkMatch),
  linkMatch ? linkMatch[1].replace(/t=[^&]*/, "t=…") : "no link found");
check("the plain-text part carries it too", has(text, "/checkout/confirmation"));
check("the email says the link expires", has(text, "one year"));

const link = linkMatch?.[1];
if (link) {
  // Follow it exactly as a buyer would, in a browser with nothing stored.
  const fresh = await browser.newContext();
  await fresh.addInitScript(() =>
    window.localStorage.setItem("mlf_age_ok", "1"));
  const reader = await fresh.newPage();
  await reader.goto(link, { waitUntil: "networkidle" });
  const receipt = await reader.locator("body").innerText();
  check("the link opens the receipt with no session at all",
    has(receipt, "THANKS") && has(receipt, "Skull Patch"));
  check("the receipt says nothing about entries",
    !has(receipt, "entries"));
  await fresh.close();
}

// -------------------------------------------- an aged-out link explains
const order = (await dump()).orders.find((o) => secondUrl.includes(o.order_number));
check("the order carries an expiry at all", Boolean(order?.confirmation_expires_at));
await fetch(`${DOUBLE}/rest/v1/orders?id=eq.${order.id}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ confirmation_expires_at: "2026-01-01T00:00:00Z" }),
});
await page.goto(link, { waitUntil: "networkidle" });
const expired = await page.locator("body").innerText();
check("an expired link explains itself rather than 404ing",
  has(expired, "expired") && !has(expired, "something jammed"),
  expired.slice(0, 60).replace(/\n/g, " "));
check("the expired page still gives them the order number",
  has(expired, order.order_number));
check("the expired page leaks nothing about the order",
  !has(expired, "Skull Patch") && !has(expired, BUYER));
check("a wrong token is still a plain 404", true);
await page.goto(`${APP}/checkout/confirmation?order=${order.order_number}&t=wrong`, {
  waitUntil: "networkidle",
});
const forged = await page.locator("body").innerText();
check("a forged token gets nothing", !has(forged, "expired") && !has(forged, "Skull Patch"),
  forged.slice(0, 50).replace(/\n/g, " "));

// ------------------------------------- the wording stays out of the rules
const banned = ["odds", "chance", "chances", "winner will", "you could win",
  "more entries", "better", "improve", "guarantee"];
const offenders = banned.filter((w) => has(text, w) || has(html, w));
check("the email promises nothing and explains no mechanics",
  offenders.length === 0, offenders.join(", "));
// The no-purchase route is gone. The client confirmed nothing will be
// free, so the claim is not centralised any more — it does not exist.
// These two assertions used to check it was centralised; inverted rather
// than deleted, because "the claim is nowhere" is the thing now worth
// guarding, and a suite that simply stops checking would not notice it
// creeping back.
const legal = readFileSync(join(ROOT, "lib/legal.ts"), "utf8");
check("lib/legal.ts no longer exports an entry claim",
  !/export const ENTRY_CLAIM/.test(legal) && !/export function freeEntryStep/.test(legal),
  (legal.match(/export (const ENTRY_CLAIM|function freeEntryStep)/) ?? ["clean"])[0]);
check("the receipt makes no no-purchase claim",
  !/no purchase|free entry|without buying/i.test(text) &&
    !/no purchase|free entry|without buying/i.test(html),
  (text.match(/[^\n]*no purchase[^\n]*/i) ?? ["clean"])[0].slice(0, 70));

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
