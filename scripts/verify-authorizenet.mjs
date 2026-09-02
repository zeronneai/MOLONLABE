#!/usr/bin/env node
// Checks that this environment can actually talk to Authorize.net, and
// that the credentials in it are the ones you think they are.
//
//   node scripts/verify-authorizenet.mjs
//
// Reads AUTHORIZENET_API_LOGIN_ID, AUTHORIZENET_TRANSACTION_KEY,
// NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY and NEXT_PUBLIC_AUTHORIZENET_ENV
// from the environment. Run it with your .env loaded, e.g.
//
//   set -a && . ./.env.local && set +a && node scripts/verify-authorizenet.mjs
//
// It charges nothing. `authenticateTestRequest` is Authorize.net's own
// credential check: it proves the endpoint is reachable, the login id and
// transaction key are a valid pair, and the response parses — which
// together are every failure mode that is not a card problem.

const ENV = (process.env.NEXT_PUBLIC_AUTHORIZENET_ENV ?? "sandbox").toLowerCase();
const PRODUCTION = ENV === "production";
const API = PRODUCTION
  ? "https://api.authorize.net/xml/v1/request.api"
  : "https://apitest.authorize.net/xml/v1/request.api";

const login = process.env.AUTHORIZENET_API_LOGIN_ID?.trim();
const key = process.env.AUTHORIZENET_TRANSACTION_KEY?.trim();
const clientKey = process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY?.trim();

const fail = (msg) => {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
};
const pass = (msg) => console.log(`ok    ${msg}`);

console.log(`Authorize.net check — ${PRODUCTION ? "PRODUCTION" : "sandbox"}`);
console.log(`endpoint ${API}\n`);

if (PRODUCTION) {
  console.log(
    "NOTE: NEXT_PUBLIC_AUTHORIZENET_ENV is 'production'. This still charges\n" +
      "      nothing, but confirm that is what you intended.\n",
  );
}

let missing = false;
for (const [name, value] of [
  ["AUTHORIZENET_API_LOGIN_ID", login],
  ["AUTHORIZENET_TRANSACTION_KEY", key],
  ["NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY", clientKey],
]) {
  if (!value) {
    fail(`${name} is not set`);
    missing = true;
  } else {
    pass(`${name} present (${value.length} chars)`);
  }
}
if (missing) {
  console.error(
    "\nAll three are required. The public client key is what the browser\n" +
      "uses to tokenize; without it the card form cannot load, and a\n" +
      "missing transaction key fails only after the buyer has typed their\n" +
      "card in.",
  );
  process.exit(1);
}

// A public client key that looks like a transaction key is the classic
// mix-up, and it fails in a confusing place: tokenization succeeds and
// the charge is rejected.
if (clientKey.length < 40) {
  console.warn(
    `warn  NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY is only ${clientKey.length} chars.\n` +
      "      The Public Client Key is long (typically 80+). A 16-character\n" +
      "      value is probably the Transaction Key pasted into the wrong\n" +
      "      variable — check Account -> Manage Public Client Key.",
  );
}

const body = {
  authenticateTestRequest: {
    merchantAuthentication: { name: login, transactionKey: key },
  },
};

let raw;
try {
  const response = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  raw = await response.text();
  if (!response.ok) {
    fail(`gateway returned HTTP ${response.status}`);
    process.exit(1);
  }
  pass("endpoint reachable");
} catch (err) {
  fail(`could not reach the gateway: ${err.message}`);
  console.error(
    "\nIf this is a network policy rather than a credential problem, the\n" +
      "checkout cannot be verified from this machine at all. See\n" +
      "docs/authorizenet-sandbox.md.",
  );
  process.exit(1);
}

// The gateway prefixes JSON with a UTF-8 BOM. Stripping it is exactly
// what lib/payments/authorizenet.ts does; if this line is ever removed
// there, this check will keep passing while the app breaks — which is why
// the app has its own.
let parsed;
try {
  parsed = JSON.parse(raw.replace(/^﻿/, "").trim());
  pass("response parsed (BOM handled)");
} catch {
  fail("response was not JSON after stripping the BOM");
  console.error(raw.slice(0, 400));
  process.exit(1);
}

const result = parsed?.messages?.resultCode;
const message = parsed?.messages?.message?.[0];

if (result === "Ok") {
  pass(`credentials accepted — ${message?.text ?? "successful"}`);
  console.log(
    "\nGateway side is good. What this does NOT prove: that Accept.js can\n" +
      "load in a browser on this network, or that a real card tokenizes.\n" +
      "For that, run the app with these variables set, put something in the\n" +
      "cart and pay with an Authorize.net test card:\n" +
      "\n" +
      "  4111111111111111  approves\n" +
      "  4000000000000002  declines\n" +
      "  any future expiry, any CVV\n",
  );
} else {
  fail(`credentials rejected — ${message?.code ?? "?"} ${message?.text ?? ""}`);
  if (message?.code === "E00007") {
    console.error(
      "\nE00007 is 'User authentication failed'. Usual causes: the API Login\n" +
        "ID and Transaction Key are from different accounts, the key was\n" +
        "regenerated in the dashboard (which invalidates the old one), or\n" +
        "sandbox credentials are being sent to the production endpoint.\n" +
        "Check NEXT_PUBLIC_AUTHORIZENET_ENV.",
    );
  }
}
