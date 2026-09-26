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
// The client's eligibility paragraph exactly as he sent it (2026-09-25).
// Held here as a literal rather than read from the page's source, so an
// edit to the source cannot also edit what it is checked against.
const CLIENT_ELIGIBILITY =
  "Prize eligibility and transfer are subject to all applicable federal, state, and local laws. The potential winner must be legally eligible to receive and possess the firearm in their jurisdiction. Any required firearm transfer will be completed through a Federal Firearms Licensee (FFL) in accordance with applicable law. No firearm will be transferred or delivered where prohibited by law.";

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
// The client's edits of 2026-09-25 and decisions of 2026-09-26, as
// published. Clause numbers are the page's own continuous numbering;
// clause 02 was cut on 2026-09-26, so everything after it moved up one.
const clauses = (await page.locator("main ol li").allInnerTexts())
  .map((t) => t.replace(/\s+/g, " ").trim());
const clause = (n) => clauses.find((c) => c.startsWith(String(n).padStart(2, "0"))) ?? "";
check("there are 23 clauses", clauses.length === 23, `${clauses.length}`);
const exact = [
  [1, "You must be 21 years or older to buy a guide and to win."],
  [2, CLIENT_ELIGIBILITY],
  [4, "All purchases are subject to Texas sales tax at 8.25%."],
  [5, "No refunds or exchanges."],
  [6, "A person may buy as many guides as they want, up to the total offered in that drop."],
  [10, "Entry requires purchasing a guide. There are no free entries."],
  [11, "A drop runs until every guide is purchased."],
  [15, "A drop is drawn once. A drop that already has a winner cannot be drawn again."],
  [16, "By purchasing a guide, the buyer agrees to provide their full name, email and phone number so the shop can contact them if they win."],
  [17, "The winner has one week from being contacted to confirm and claim the prize. If they do not, the prize returns to the shop."],
  [18, "Unclaimed prizes are sold in store only and are not listed on the website again."],
];
for (const [n, want] of exact) {
  check(`clause ${String(n).padStart(2, "0")} reads as the client wrote it`,
    clause(n).includes(want), clause(n).slice(0, 90) || "MISSING");
}
check("the client's eligibility paragraph appears exactly once, verbatim",
  text.split(CLIENT_ELIGIBILITY).length === 2);
check("clause 02, which repeated it, is gone",
  !/You must be able to receive a firearm lawfully/i.test(text));
check("the early-draw clause is gone", !/sole discretion|before every guide is sold|draw earlier/i.test(text));
check("the state-limit question is gone", !/state or residency/i.test(text));
check("the rules say drop, not game, in the headings and clause 15",
  /^When a drop closes$/im.test(text) && !/\bgames?\b/i.test(clauses.join(" ")),
  (clauses.join(" ").match(/.{0,30}\bgames?\b.{0,30}/i) ?? ["clean"])[0]);

// The seven drafts of 2026-09-26, held here as literals so an edit to the
// source cannot also edit the check. Each is published with the marker
// until the client confirms the set.
const DRAFTS = [
  [3, "Each drop offers a set number of guides at a set price per guide. Both are fixed when the drop is created and do not change while it runs."],
  [7, "Each guide in a drop has a number, from 1 up to the number of guides offered. Numbers are assigned automatically at checkout from those still available, lowest first. A buyer cannot choose them, and a buyer who gets several may not get consecutive numbers."],
  [8, "Adding more guides from the same drop to a cart adds them to the guides already there, and the cart shows the running total before payment. A cart holds guides from one drop at a time. If fewer guides are left than the cart holds, the cart is reduced to the number left before payment."],
  [9, "Guide numbers are set aside when the buyer submits payment and are held while the payment is processed. If the payment does not go through, they are released at once. If the payment is interrupted, they are released after 15 minutes. A guide belongs to the buyer only once payment succeeds."],
  [12, "A drop is drawn only after every guide has been sold, and every guide sold is in the drawing."],
  [13, "Each guide is one entry, and every entry has the same chance of winning. A person holding five guides has five times the chance of a person holding one, and five times the share of the wheel."],
  [22, "This website shows how many guides a drop has left, never who bought them. During the drawing, each buyer's first name and last initial appear on screen, as stated at checkout. A buyer who bought before checkout stated this appears by guide number instead. Email addresses, phone numbers and full surnames are never shown."],
];
const marked = await page.locator("main ol li").evaluateAll((lis) =>
  lis.map((li, i) => (li.querySelector("[data-pending-wording]") ? i + 1 : null)).filter(Boolean));
check("exactly the seven drafts are marked wording to be confirmed",
  JSON.stringify(marked) === JSON.stringify(DRAFTS.map(([n]) => n)), marked.join(", "));
for (const [n, want] of DRAFTS) {
  check(`draft ${String(n).padStart(2, "0")} is published with its marker`,
    /wording to be confirmed/i.test(clause(n)) && clause(n).includes(want),
    clause(n).slice(0, 90) || "MISSING");
}
// Clause 14 as the client decided it (2026-09-25), held as a literal
// here so an edit to the source cannot also edit the check.
const DRAW_METHOD =
  "The winner is selected by an electronic name wheel, weighted by the number of guides each person holds. The drawing is run at the shop, broadcast live on our Instagram, @molonlabe.fa, and saved as a reel. Before the wheel is spun, every entry is shown on screen so viewers can confirm all buyers were included. The result is recorded.";
check("clause 14 is the client's wording, verbatim", clause(14).includes(DRAW_METHOD),
  clause(14).slice(0, 90));
check("clause 14 is not marked as a draft", !/wording to be confirmed/i.test(clause(14)));

// ---------------------------------------------- how the page presents it
check("the title is the client's", /^Official Sweepstakes Rules$/m.test(text),
  (text.match(/[^\n]*sweepstakes rules[^\n]*/i) ?? ["MISSING"])[0]);
check("the tab title is the client's",
  /Official Sweepstakes Rules/.test(await page.title()), await page.title());
const noRefunds = page.locator("[data-no-refunds]");
check("no refunds is said at display size near the top, not as fine print",
  (await noRefunds.count()) === 1 &&
    parseFloat(await noRefunds.evaluate((el) => getComputedStyle(el).fontSize)) >= 20,
  await noRefunds.evaluate((el) => getComputedStyle(el).fontSize).catch(() => "absent"));
const html = await page.evaluate(() => {
  const c = document.body.cloneNode(true);
  for (const el of c.querySelectorAll("script, style")) el.remove();
  return c.textContent;
});
check("there is no em dash anywhere on the page", !html.includes("\u2014"),
  (html.match(/.{0,40}\u2014.{0,40}/) ?? ["none"])[0]);

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
// The cap is gone from the code, so it must be gone from the terms. This
// assertion is the one that failed when the code changed and the rules
// did not, which is exactly what it is for.
check("states no per-order spot cap, because there is none",
  !/\b25\b[^\n]{0,30}(order|transaction)/i.test(text),
  (text.match(/[^\n]*\b25\b[^\n]*/) ?? ["no stale cap"])[0].slice(0, 60));

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

// The early draw is gone everywhere (2026-09-26), so the checkout terms
// and the rules now say the same thing: drawn when the last guide sells.
check("the buy control says the winner is drawn once the last guide sells",
  /drawn once the last guide sells\./i.test(buy));
check("and no longer says the shop may draw earlier",
  !/draw earlier|at its discretion/i.test(buy));
check("the buy control shows the broadcast notice the rules refer to",
  /broadcast live on Instagram and saved as a reel\. Your first name and last initial will appear on screen\./.test(buy));
// The no-end-date statement lives at the buy control and checkout.
check("the buy control still says there is no end date",
  /no end date/i.test(buy));

// The one-line summary under the rules link comes from the same constant
// the rules page uses for its eligibility section, so they cannot drift.
check("the eligibility summary states the age, like the rules do",
  /21 or older/i.test(buy),
  (buy.match(/[^\n]*21 or older[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 70));

note("the rules page and the buy control are written in different files; this suite is what keeps them saying the same thing");

await browser.close();
report();
