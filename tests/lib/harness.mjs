// Shared test plumbing: assertions, a browser, and a signed-in admin.
//
// Every suite reports the same way — a list of PASS/FAIL lines and a
// count — so the runner can aggregate them without parsing prose.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { APP, ARTIFACTS, CHROMIUM, DOUBLE, MANAGER, OWNER, STRANGER } from "./config.mjs";

export function suite() {
  const ok = [];
  const bad = [];
  const notes = [];
  return {
    /**
     * `detail` is printed on failure AND on success. That is deliberate:
     * a passing assertion that prints what it actually saw is how you
     * notice a test passing for the wrong reason.
     */
    check(label, passed, detail = "") {
      (passed ? ok : bad).push(
        `${passed ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
      );
    },
    /** Something worth printing that is not pass or fail. */
    note(text) {
      notes.push(text);
    },
    /** Prints the result and exits with the right code. */
    report() {
      for (const l of ok) console.log(l);
      for (const l of bad) console.log(l);
      if (notes.length) {
        console.log("");
        for (const n of notes) console.log("· " + n);
      }
      console.log(`\n${ok.length} passed, ${bad.length} failed`);
      process.exit(bad.length === 0 ? 0 : 1);
    },
  };
}

/** Resets the double to its seeded state. Call at the top of every test. */
export const reset = () => fetch(`${DOUBLE}/__reset`);

/** The seeded game, whose prize is the seeded rifle. */
const SEEDED_GAME = "55555555-5555-4555-8555-555555555555";

/**
 * Makes the seeded rifle ordinary stock by detaching it from the seeded
 * game.
 *
 * The seeded game's prize IS the rifle, and a prize in an open or full
 * game cannot be bought — the pricer refuses the line, because somebody
 * buying the prize outright while others pay for a chance at it is the
 * failure that rule exists to prevent.
 *
 * So any suite that carts the rifle for some OTHER reason — tax, sizes,
 * a mixed order — has to say so. Call this after every reset() in those
 * suites; reset() restores the seed, which restores the prize.
 *
 * Deliberately not folded into reset(): suites like prizelock and
 * surfaces depend on the seeded game having a prize, and a reset that
 * quietly unhooked it would make the guard untestable.
 */
export const detachSeededPrize = () =>
  fetch(`${DOUBLE}/rest/v1/games?id=eq.${SEEDED_GAME}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ item_id: null }),
  });

/** Everything the double is currently holding. */
export const dump = async () => (await fetch(`${DOUBLE}/__dump`)).json();

/**
 * What is in storage: key, type, size and a digest, never the bytes.
 *
 * The digest is what makes "it was rebuilt" and "it was NOT rebuilt"
 * both assertable. Without it the only evidence of a regeneration is a
 * timestamp, and a timestamp cannot tell a rebuild from a rewrite of the
 * same thing.
 */
export const storage = async () => (await fetch(`${DOUBLE}/__storage`)).json();

const JSON_HEADERS = { "content-type": "application/json" };

/** POST a row into the double. */
export const insert = (table, row) =>
  fetch(`${DOUBLE}/rest/v1/${table}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(row),
  });

/** POST a row and get it back, for when you need the generated id. */
export async function insertReturning(table, row) {
  const res = await fetch(`${DOUBLE}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...JSON_HEADERS, prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  return (await res.json())[0];
}

/** PATCH rows in the double. `filter` is PostgREST query syntax. */
export const update = (table, filter, patch) =>
  fetch(`${DOUBLE}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
  });

export async function browser(options = {}) {
  return chromium.launch({ executablePath: CHROMIUM, ...options });
}

/**
 * A page with the age gate already satisfied, because every test would
 * otherwise spend its first action dismissing it.
 */
export async function page(b, contextOptions = {}) {
  const ctx = await b.newContext(contextOptions);
  await ctx.addInitScript(() => localStorage.setItem("mlf_age_ok", "1"));
  return ctx.newPage();
}

/** A page signed in as the shop owner. */
export async function adminPage(b, contextOptions = {}) {
  return signedInPage(b, OWNER, contextOptions);
}

/** A page signed in as the manager. */
export async function managerPage(b, contextOptions = {}) {
  return signedInPage(b, MANAGER, contextOptions);
}

/** A page signed in as an account with no access. */
export async function strangerPage(b, contextOptions = {}) {
  return signedInPage(b, STRANGER, contextOptions);
}

async function signedInPage(b, account, contextOptions) {
  const p = await page(b, contextOptions);
  await p.goto(`${APP}/admin`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', account.email);
  await p.fill('input[type="password"]', account.password);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(2000);
  return p;
}

/** Accept.js, stubbed. `delayMs` is the gap the double-charge bug lived in. */
export function acceptStub(delayMs = 0) {
  return (ms) => {
    window.Accept = {
      dispatchData: (data, handler) => {
        const reply = () =>
          handler({
            messages: { resultCode: "Ok", message: [] },
            opaqueData: {
              dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT",
              dataValue: "NONCE-OK",
            },
          });
        ms > 0 ? setTimeout(reply, ms) : reply();
      },
    };
    localStorage.setItem("mlf_age_ok", "1");
  };
}

/** Scratch directory for artifacts, created on demand. */
export function artifacts() {
  mkdirSync(ARTIFACTS, { recursive: true });
  return ARTIFACTS;
}

export const has = (haystack, needle) =>
  String(haystack).toLowerCase().includes(String(needle).toLowerCase());
