// Reproduce the double charge, then prove it fixed.
//
// The double counts every call that reaches the gateway, so "two charges"
// is a fact from the payment side rather than an inference from two order
// rows. Accept.js is stubbed with a realistic delay: the real one talks
// to Authorize.net over the network, and the gap between the click and
// the callback is the entire window this bug lives in.

import { chromium } from "playwright";
import { APP, DOUBLE, CHROMIUM } from "../lib/config.mjs";



const PATCH = "44444444-4444-4444-8444-444444444444";
const GAME = "55555555-5555-4555-8555-555555555555";
// Spots by default: a single-unit item is accidentally protected by the
// inventory claim (the second attempt finds it already reserved), which
// masks the bug. A game has five spots, so a second attempt happily takes
// two more and charges again.
const BUY = process.env.BUY ?? "spots";
const TOKENISE_MS = Number(process.env.TOKENISE_MS ?? 700);

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const dump = async () => (await fetch(`${DOUBLE}/__dump`)).json();

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function fillCheckout(page) {
  await page.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([what, id, game]) =>
      localStorage.setItem(
        "mlf_cart",
        JSON.stringify(
          what === "spots"
            ? [{ gameId: game, quantity: 1 }]
            : [{ itemId: id, quantity: 1 }],
        ),
      ),
    [BUY, PATCH, GAME],
  );
  await page.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
  for (const [k, v] of [
    ["#firstName", "Dana"], ["#lastName", "Ruiz"], ["#email", "dana.ruiz@example.com"],
    ["#shipLine1", "1200 Texas Ave"], ["#shipCity", "El Paso"], ["#shipRegion", "TX"],
    ["#shipPostalCode", "79901"], ["#cardNumber", "4111111111111111"],
    ["#cardMonth", "12"], ["#cardYear", "2029"], ["#cardCode", "123"], ["#cardZip", "79901"],
  ]) if (await page.locator(k).count()) await page.fill(k, v);
  const boxes = page.getByRole("checkbox");
  await boxes.first().check();
  if (BUY === "spots") await boxes.nth(1).check();
}

async function newPage() {
  const ctx = await browser.newContext();
  await ctx.addInitScript((ms) => {
    // Realistic: tokenisation is a round trip, not instant.
    window.Accept = {
      dispatchData: (d, h) =>
        setTimeout(
          () =>
            h({
              messages: { resultCode: "Ok", message: [] },
              opaqueData: {
                dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
                dataValue: "NONCE-OK",
              },
            }),
          ms,
        ),
    };
    localStorage.setItem("mlf_age_ok", "1");
  }, TOKENISE_MS);
  return ctx.newPage();
}

// ------------------------------------------- an impatient double click
{
  await fetch(`${DOUBLE}/__reset`);
  const page = await newPage();
  await fillCheckout(page);

  const pay = page.locator('form button[type="submit"]');

  // Click, then look at the button 150ms later — before tokenisation
  // could possibly have come back. This is what the customer sees.
  await pay.click();
  await page.waitForTimeout(150);
  const disabledAfterFirst = await pay.isDisabled();
  const labelAfterFirst = (await pay.innerText()).trim();
  check("the button disables on the first click", disabledAfterFirst,
    disabledAfterFirst ? "disabled" : "STILL CLICKABLE");
  check("and says something is happening",
    /processing|working|paying/i.test(labelAfterFirst), labelAfterFirst);

  // Whatever it looks like, click again the way an impatient person does.
  await pay.click({ force: true }).catch(() => {});
  await page.waitForTimeout(TOKENISE_MS + 3500);

  const d = await dump();
  check("the card was charged exactly once",
    d.charges.length === 1, `${d.charges.length} gateway calls`);
  check("exactly one order exists", d.orders.length === 1, `${d.orders.length}`);
  await page.context().close();
}

// --------------------------- two requests, same cart, at the same time
{
  await fetch(`${DOUBLE}/__reset`);
  const a = await newPage();
  const b = await newPage();
  await Promise.all([fillCheckout(a), fillCheckout(b)]);

  // Two tabs, same cart, submitted together. The idempotency key is per
  // rendered form, so these are genuinely two attempts rather than one
  // retried — the strictest case the server guard has to survive.
  await Promise.all([
    a.locator('form button[type="submit"]').click(),
    b.locator('form button[type="submit"]').click(),
  ]);
  await a.waitForTimeout(TOKENISE_MS + 4000);

  const d = await dump();
  // One of them wins the item; the other must be refused, not charged.
  check("two simultaneous submissions charge at most twice, never more",
    d.charges.length <= 2, `${d.charges.length} gateway calls`);
  check("no spot was sold to nobody",
    (d.game_spots ?? []).filter((x) => x.status === "held").length === 0,
    `${(d.game_spots ?? []).filter((x) => x.status === "held").length} stuck held`);
  await a.context().close();
  await b.context().close();
}

// ------------------- the same key submitted twice (a reload-and-resend)
{
  await fetch(`${DOUBLE}/__reset`);
  const page = await newPage();
  await fillCheckout(page);

  // The key exists on the rendered form, before anything is submitted.
  const key = await page.evaluate(() => sessionStorage.getItem("mlf_checkout_key"));
  check("the form mints an idempotency key when it renders", Boolean(key), String(key));

  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/confirmation/, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const first = await dump();
  check("the first submission charged once", first.charges.length === 1,
    `${first.charges.length}`);
  check("and stored the key on the order",
    first.orders[0]?.idempotency_key === key, String(first.orders[0]?.idempotency_key));
  check("the key is cleared once the order lands, so the next sale is its own",
    (await page.evaluate(() => sessionStorage.getItem("mlf_checkout_key"))) === null);

  // Now the real hazard: the buyer reloads mid-payment and resubmits.
  // Put the same key back and go through checkout again.
  await page.evaluate((k) => sessionStorage.setItem("mlf_checkout_key", k), key);
  await fillCheckout(page);
  const reused = await page.evaluate(() => sessionStorage.getItem("mlf_checkout_key"));
  check("the reloaded form reuses the stored key rather than minting a new one",
    reused === key, `${reused} vs ${key}`);

  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(TOKENISE_MS + 3500);

  const second = await dump();
  check("a replay of the same key does NOT charge again",
    second.charges.length === 1, `${second.charges.length} gateway calls`);
  check("and does not create a second order",
    second.orders.length === 1, `${second.orders.length} orders`);
  check("the buyer lands on their original receipt",
    /confirmation/.test(page.url()) &&
      page.url().includes(second.orders[0].order_number),
    page.url().replace(/t=[^&]*/, "t=…"));
  await page.context().close();
}

await browser.close();
for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
