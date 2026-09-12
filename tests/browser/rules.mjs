// The official rules.
//
// This is the one page on the site where being wrong is a legal problem
// rather than a design one, so what is asserted here is mostly ABSENCE
// and AGREEMENT:
//
//   absence   — no banned word, no draft chrome, no claim of a free
//               route, no promise the system cannot keep
//   agreement — the page must not contradict the terms shown at the buy
//               control and at checkout, because a buyer sees those and
//               may never open this page at all
//
// The second is the one that actually bit: GAME_TERMS promised "the
// winner is drawn once the last spot sells" while the admin could draw a
// short game whenever it liked. Every buyer who ticked that consent had
// been told something untrue. A test that reads both surfaces is the only
// thing that catches a drift like that, because each reads fine alone.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { APP, CHROMIUM, ROOT } from "../lib/config.mjs";
import { suite, reset, page as newPage } from "../lib/harness.mjs";

const { check, note, report } = suite();

/**
 * The attorney's wording, read out of lib/legal.ts rather than retyped.
 *
 * Retyping it here would defeat the check: the assertion would then
 * compare the page against my copy of his text instead of against his,
 * and the two could drift together without anything noticing. Read from
 * source, a reflow or a "corrected" apostrophe fails this.
 */
const FIREARM_DISCLAIMER = readFileSync(
  join(ROOT, "lib/legal.ts"),
  "utf8",
).match(/FIREARM_DISCLAIMER =\s*"([\s\S]*?)";/)[1];

await reset();
const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await newPage(browser);

await page.goto(`${APP}/sweepstakes-rules`, { waitUntil: "networkidle" });
const text = await page.locator("body").innerText();

// ------------------------------------------------------ the banned words
// Non-negotiable across the whole repo, and this is the page most likely
// to attract them back, because every template for a document like this
// uses them.
for (const word of ["raffle", "lottery", "rifa"]) {
  check(`the rules never say "${word}"`,
    !new RegExp(`\\b${word}`, "i").test(text),
    (text.match(new RegExp(`[^\\n]*${word}[^\\n]*`, "i")) ?? ["clean"])[0].slice(0, 60));
}

// ----------------------------------------------------- no draft chrome
check("no placeholder or draft banner",
  !/placeholder|not legal copy|scaffolding|pending review|draft/i.test(text),
  (text.match(/[^\n]*(placeholder|draft|scaffolding)[^\n]*/i) ?? ["clean"])[0].slice(0, 60));
check("does not describe itself as unreviewed",
  !/has not been reviewed|needs? an? (lawyer|attorney)/i.test(text));

// ------------------------------------------------- the operative clauses
const must = [
  [/21 or older/i, "the age requirement, matching the age gate"],
  [/fixed number of spots/i, "fixed pool"],
  [/8\.25%/, "the sales tax rate"],
  [/final\./i, "purchases are final"],
  [/no end date/i, "no end date"],
  [/sole discretion/i, "the early-draw permission"],
  [/at random/i, "random selection"],
  [/recorded random seed/i, "the recorded seed"],
  [/federally licensed firearms dealer/i, "the FFL transfer condition"],
  [/first name and last initial/i, "how a winner is published"],
  [/only be bought/i, "purchase-only, stated rather than omitted"],
  [/25 in a single order/i, "the per-order cap, which the checkout enforces"],
];
for (const [re, what] of must) {
  check(`states ${what}`, re.test(text),
    (text.match(re) ?? ["MISSING"])[0].toString().slice(0, 50));
}

// ------------------------------- the attorney's wording, character exact
// The single most important assertion on this page. His text appears in
// four places now and this is the newest; a paraphrase here would be a
// paraphrase of legal advice, and it would look completely fine.
check("the firearm clause is the attorney's text, exactly",
  text.includes(FIREARM_DISCLAIMER),
  FIREARM_DISCLAIMER.length > 0
    ? `${FIREARM_DISCLAIMER.length} chars expected`
    : "COULD NOT READ THE CONSTANT");
note(`checked ${FIREARM_DISCLAIMER.length} characters of attorney wording against lib/legal.ts`);

// ------------------------------------------ nothing it cannot deliver
check("does not claim an automated email tells the winner",
  !/we will email you|you will receive an email/i.test(text),
  "there is no winner-notification email in the system");
check("does not claim a no-purchase route",
  !/no purchase is necessary|free entry|alternative method of entry/i.test(text));
check("does not promise an entry period or closing date",
  !/entry period|closes on|closing date/i.test(text));

// ------------------------------------------------- the three open items
const pending = (text.match(/to be confirmed/gi) ?? []).length;
check("exactly three items are marked as the shop's to answer",
  pending === 3, `${pending} found`);
check("the claim window is one of them", /how long the winner has to respond/i.test(text));
check("the unclaimed prize is one of them", /unclaimed prize/i.test(text));
check("eligibility limits are one of them", /state or residency/i.test(text));

// ------------------------------------------------------- noindex holds
const robots = await page
  .locator('meta[name="robots"]')
  .getAttribute("content")
  .catch(() => null);
check("the page is still noindex", /noindex/i.test(robots ?? ""), String(robots));

// -------------------------------- it must not contradict what a buyer saw
// The checkout terms and the rules are written in different files by
// different rules of thumb. This is the check that they still agree.
await page.goto(`${APP}/featured`, { waitUntil: "networkidle" });
const buy = await page.locator("body").innerText();

check("the buy control mentions the early draw, as the rules do",
  /draw earlier|may draw earlier|earlier at its discretion/i.test(buy),
  (buy.match(/[^\n]*earlier[^\n]*/i) ?? ["NOT MENTIONED"])[0].slice(0, 80));
check("the buy control does NOT promise a draw only when the last spot sells",
  !/drawn once the last spot sells\.(?!\s*The shop may)/i.test(buy));
check("both surfaces agree there is no end date",
  /no end date/i.test(buy) && /no end date/i.test(text));

// The one-line summary under the rules link comes from the same constant
// the rules page uses for its eligibility section, so they cannot drift.
check("the eligibility summary states the age, like the rules do",
  /21 or older/i.test(buy),
  (buy.match(/[^\n]*21 or older[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 70));

note("the rules page and the buy control are written in different files; this suite is what keeps them saying the same thing");

await browser.close();
report();
