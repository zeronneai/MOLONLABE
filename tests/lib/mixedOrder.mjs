// Places the order the confirmation email has to handle worst: a firearm
// collected in store alongside a sized shirt that ships, so the email
// must render both a shipping block and a collection block, a size, and
// two different fulfilment types in one table.
//
// This lives here rather than in a test because two suites need it.
// `emaildesign` used to read files that `mixed` had written, which made
// the result depend on the order the suite ran in — and worse, on files
// left over from a PREVIOUS run. Two assertions in emaildesign passed for
// months against an email the app had stopped producing. A suite that
// depends on run order will eventually report something untrue.

import { chromium } from "playwright";
import { APP, CHROMIUM, DOUBLE } from "./config.mjs";

const RIFLE = "11111111-1111-4111-8111-111111111111";
const SHIRT = "33333333-3333-4333-8333-333333333333";
const V_M = "aaaaaaaa-0000-4000-8000-000000000002";

/**
 * Buys the mixed cart and returns what the app actually sent:
 * `{ html, text, notifications }`. Resets the double first, so the
 * caller inherits no state from anything that ran before it.
 */
export async function placeMixedOrder() {
  await fetch(`${DOUBLE}/__reset`);
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      window.Accept = {
        dispatchData: (d, h) =>
          h({
            messages: { resultCode: "Ok", message: [] },
            opaqueData: {
              dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
              dataValue: "NONCE-OK",
            },
          }),
      };
      localStorage.setItem("mlf_age_ok", "1");
    });
    const p = await ctx.newPage();
    await p.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
    await p.evaluate(
      ([r, s, v]) =>
        localStorage.setItem(
          "mlf_cart",
          JSON.stringify([
            { itemId: r, quantity: 1 },
            { itemId: s, quantity: 2, variantId: v },
          ]),
        ),
      [RIFLE, SHIRT, V_M],
    );
    await p.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
    for (const [sel, val] of [
      ["#firstName", "Dana"], ["#lastName", "Ruiz"],
      ["#email", "dana.ruiz@example.com"], ["#phone", "9155550100"],
      ["#shipLine1", "1200 Texas Ave"], ["#shipCity", "El Paso"],
      ["#shipRegion", "TX"], ["#shipPostalCode", "79901"],
      ["#cardNumber", "4111111111111111"], ["#cardMonth", "12"],
      ["#cardYear", "2029"], ["#cardCode", "123"], ["#cardZip", "79901"],
    ]) {
      if (await p.locator(sel).count()) await p.fill(sel, val);
    }
    await p.getByRole("checkbox").check();
    await p.locator('form button[type="submit"]').click();
    await p.waitForURL(/confirmation/, { timeout: 25000 });
    await p.waitForTimeout(900);

    const d = await (await fetch(`${DOUBLE}/__dump`)).json();
    if (!d.emails?.length) throw new Error("no confirmation email was sent");
    return {
      html: d.emails[0].html,
      text: d.emails[0].text,
      notifications: d.notifications,
    };
  } finally {
    await browser.close();
  }
}
