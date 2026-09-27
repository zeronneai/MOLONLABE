// The payment mode, reported where the go-live steps tell you to look.
//
// docs/go-live.md says to open /api/health after switching and read
// payments.mode. That value has to be computed the way the checkout
// computes it, and the checkout has to load the matching Accept.js. The
// test build is sandbox, so this checks the sandbox side of the switch
// and that the two agree.

import { APP } from "../lib/config.mjs";
import { browser, page as newPage, reset, suite } from "../lib/harness.mjs";

const { check, report } = suite();
await reset();
const b = await browser();
const p = await newPage(b);

const health = await (await p.request.get(`${APP}/api/health`)).json();
check("/api/health reports the payment mode", health?.payments?.mode === "sandbox",
  JSON.stringify(health?.payments?.mode));
check("and never echoes a credential",
  !JSON.stringify(health.payments).match(/"AUTHORIZENET_TRANSACTION_KEY":"/),
  JSON.stringify(health.payments).slice(0, 160));

await p.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
await p.evaluate(() => localStorage.setItem("mlf_cart",
  JSON.stringify([{ itemId: "22222222-2222-4222-8222-222222222222", quantity: 1 }])));
await p.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
const scripts = await p.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
const accept = scripts.find((s) => /authorize\.net/.test(s)) ?? "";
check("the checkout loads the sandbox Accept.js to match",
  accept === "https://jstest.authorize.net/v1/Accept.js", accept || scripts.join(", "));

await b.close();
report();
