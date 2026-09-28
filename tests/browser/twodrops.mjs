// Two drops open at once, through the real site.
//
// The failure this exists for: with BOOM STICK and Orthos both open,
// every button on the site went to one "current drop" page showing the
// newest, so clicking BOOM STICK opened Orthos and a buyer could pay for
// the wrong drawing without noticing. Here the seeded drop is the older
// one, a second drop opens after it, and a buyer goes through each
// surface: the drops list, the home page, the cart, checkout, the
// receipt, and the email. Then the owner and the manager at the home page
// choice.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, ARTIFACTS } from "../lib/config.mjs";
import {
  acceptStub, adminPage, browser, dump, insert, managerPage, page as newPage, reset, suite,
} from "../lib/harness.mjs";

const { check, report } = suite();
const SHOTS = join(ARTIFACTS, "twodrops");
mkdirSync(SHOTS, { recursive: true });

const OLDER = "55555555-5555-4555-8555-555555555555"; // the seeded drop
const OLDER_TITLE = "September Rifle Game";
const NEWER = "66666666-6666-4666-8666-666666666666";
const NEWER_TITLE = "Orthos Drop";
const PATCH = "44444444-4444-4444-8444-444444444444";

await reset();
await insert("games", {
  id: NEWER, title: NEWER_TITLE, item_id: PATCH, description: "The second drop, opened later.",
  status: "open", winner_note: null, total_spots: 8, spot_price_cents: 4000, featured_on_home: false,
  guide_why: "Why text for the second drop, long enough to count as written.",
  guide_care: "Care text for the second drop, long enough to count as written.",
  guide_pairs: "Pairs text for the second drop, long enough to count as written.",
  created_at: "2026-09-25T00:00:00Z",
});
for (let n = 1; n <= 8; n++) {
  await insert("game_spots", {
    id: `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`, game_id: NEWER, spot_number: n,
    status: "open", order_id: null, first_name: null, last_name: null, email: null, phone: null,
    held_at: null, sold_at: null,
  });
}

const b = await browser();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(acceptStub(0), 0);
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const text = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");

// ------------------------------------------------------------ the drops list
await p.goto(`${APP}/games`, { waitUntil: "networkidle" });
const links = await p.locator("[data-drop-link]").evaluateAll((els) =>
  els.map((a) => [a.getAttribute("data-drop-link"), a.getAttribute("href")]));
check("the drops list shows both open drops", links.length === 2, JSON.stringify(links));
check("each card's title links to its own drop's page",
  links.every(([id, href]) => href === `/games/${id}`), JSON.stringify(links));
const hrefs = await p.locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
check("nothing on the list links to a page that picks a drop", !hrefs.includes("/featured"));

// The older drop, by its card: the heart of the report.
const olderCard = p.locator("article", { has: p.locator(`[data-drop-link="${OLDER}"]`) });
await olderCard.getByRole("link", { name: "Get your guide" }).click();
await p.waitForURL(new RegExp(`/games/${OLDER}$`));
check("clicking the OLDER drop's button opens the older drop",
  (await p.locator("[data-drop-title]").innerText()) === OLDER_TITLE.toUpperCase(),
  await p.locator("[data-drop-title]").innerText());
check("its page links to the other drop by name",
  (await p.locator("[data-other-drops]").innerText()).includes(NEWER_TITLE));
await p.screenshot({ path: join(SHOTS, "older-drop-phone.png"), fullPage: true });

await p.goto(`${APP}/games`, { waitUntil: "networkidle" });
const newerCard = p.locator("article", { has: p.locator(`[data-drop-link="${NEWER}"]`) });
await newerCard.getByRole("link", { name: "Get your guide" }).click();
await p.waitForURL(new RegExp(`/games/${NEWER}$`));
check("clicking the NEWER drop's button opens the newer drop",
  (await p.locator("[data-drop-title]").innerText()) === NEWER_TITLE.toUpperCase());
check("which names its featured piece", /Featured piece: Skull Patch/.test(await text()));

// ------------------------------------------------------------ the home page
await p.goto(`${APP}/`, { waitUntil: "networkidle" });
const allDrops = p.locator("[data-home-all-drops]");
check("with nothing chosen, the home page shows every running drop rather than picking the newest",
  (await allDrops.count()) === 1 && (await allDrops.locator("[data-drop-link]").count()) === 2);
const fwd = await p.request.get(`${APP}/featured`, { maxRedirects: 0 });
check("the old /featured address forwards to the drops list when two are open and none is chosen",
  [307, 308].includes(fwd.status()) && /\/games$/.test(fwd.headers().location ?? ""),
  `${fwd.status()} ${fwd.headers().location}`);

// ------------------------------------------------------------ the owner picks
const owner = await adminPage(b, { viewport: { width: 1280, height: 1000 } });
await owner.goto(`${APP}/admin/games`, { waitUntil: "networkidle" });
const olderRow = owner.locator(`[data-drop-row="${OLDER}"]`);
check("the admin drops list links each drop to its public page",
  (await olderRow.locator("[data-view-on-site]").getAttribute("href")) === `/games/${OLDER}`);
await olderRow.locator("[data-feature-on-home]").click();
await owner.waitForTimeout(1500);
check("OWNER features the older drop on the home page",
  (await olderRow.locator("[data-home-drop-badge]").count()) === 1,
  await olderRow.innerText());
check("and it is recorded on the drop", (await dump()).games.find((g) => g.id === OLDER)?.featured_on_home === true);
const newerRow = owner.locator(`[data-drop-row="${NEWER}"]`);
await newerRow.locator("[data-feature-on-home]").click();
await owner.waitForTimeout(1500);
let games = (await dump()).games;
check("choosing the other moves it: one drop at a time",
  games.find((g) => g.id === NEWER)?.featured_on_home === true && games.find((g) => g.id === OLDER)?.featured_on_home === false);
await owner.locator(`[data-drop-row="${OLDER}"] [data-feature-on-home]`).click();
await owner.waitForTimeout(1500);

await p.goto(`${APP}/`, { waitUntil: "networkidle" });
check("the home page now features the owner's choice (the older drop), not the newest",
  (await p.locator("[data-home-drop]").getAttribute("data-home-drop")) === OLDER);
const homeLinks = await p.locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
check("its button goes to that drop's page", homeLinks.includes(`/games/${OLDER}`));
check("and the other running drop is linked by name from the home page too",
  (await p.locator("[data-home-others]").innerText()).includes(NEWER_TITLE) && homeLinks.includes(`/games/${NEWER}`));
check("the hero's drop button goes to the chosen drop",
  (await p.getByRole("link", { name: "Current Feature" }).first().getAttribute("href")) === `/games/${OLDER}`);
const fwd2 = await p.request.get(`${APP}/featured`, { maxRedirects: 0 });
check("the old /featured address now forwards to the chosen drop",
  (fwd2.headers().location ?? "").endsWith(`/games/${OLDER}`), fwd2.headers().location);

await owner.goto(`${APP}/admin/activity`, { waitUntil: "networkidle" });
check("the activity log says who put which drop on the home page",
  /Rey Marquez.{0,60}put September Rifle Game on the home page \(was Orthos Drop\)/i.test(
    (await owner.locator("main").innerText()).replace(/\s+/g, " ")));

const manager = await managerPage(b, { viewport: { width: 1280, height: 1000 } });
await manager.goto(`${APP}/admin/games`, { waitUntil: "networkidle" });
check("MANAGER sees which drop is on the home page",
  (await manager.locator(`[data-drop-row="${OLDER}"] [data-home-drop-badge]`).count()) === 1);
// The note is a .label, set in capitals by CSS, so innerText is capitals.
const managerButtons = await manager.locator("[data-feature-on-home]").count();
const managerRow = await manager.locator(`[data-drop-row="${NEWER}"]`).innerText();
check("but has no control to change it, only the owner-only note",
  managerButtons === 0 && /Home page · owner only/i.test(managerRow),
  `${managerButtons} buttons; ${managerRow.replace(/\s+/g, " ").slice(0, 160)}`);

// ------------------------------------------------------------ the cart
await p.goto(`${APP}/games/${NEWER}`, { waitUntil: "networkidle" });
await p.fill("#guide-count", "2");
await p.locator(`[data-buy-drop="${NEWER}"]`).click();
await p.waitForTimeout(500);
check("the buy control names the drop the guides were added for",
  /2 guides for Orthos Drop in your cart/.test(await p.locator("[data-in-cart]").innerText()));
await p.goto(`${APP}/cart`, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
check("the cart's guide line links to its own drop",
  (await p.locator(`[data-cart-line="game:${NEWER}"] a`).first().getAttribute("href")) === `/games/${NEWER}`);
check("the cart names the drop", (await p.locator("[data-cart-drop-name]").innerText()) === NEWER_TITLE);

// Going to the other drop with guides in the cart: said before the button.
await p.goto(`${APP}/games/${OLDER}`, { waitUntil: "networkidle" });
const warn = await p.locator("[data-cart-other-drop]").innerText().catch(() => "");
check("buying for another drop says, before the button, that the cart's guides for the first drop will be replaced",
  /Your cart has 2 guides for Orthos Drop/.test(warn) && /replaces them with guides for September Rifle Game/.test(warn), warn);
await p.locator(`[data-buy-drop="${OLDER}"]`).click();
await p.waitForTimeout(500);

// ------------------------------------------------------------ checkout
await p.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
check("checkout names the drop being bought, above the terms",
  (await p.locator("[data-checkout-drop-title]").innerText()) === OLDER_TITLE.toUpperCase() &&
    (await p.locator("[data-checkout-drop]").getAttribute("data-checkout-drop")) === OLDER);
check("and says the guides enter that drop's drawing and no other",
  /enter this drop's drawing and no other/.test(await p.locator("[data-checkout-drop]").innerText()));
await p.screenshot({ path: join(SHOTS, "checkout-phone.png"), fullPage: true });

for (const [k, v] of [
  ["#firstName", "Dana"], ["#lastName", "Ruiz"], ["#email", "dana.ruiz@example.com"],
  ["#cardNumber", "4111111111111111"], ["#cardMonth", "12"], ["#cardYear", "2029"],
  ["#cardCode", "123"], ["#cardZip", "79901"],
]) if (await p.locator(k).count()) await p.fill(k, v);
const boxes = p.getByRole("checkbox");
for (let i = 0; i < 3; i++) await boxes.nth(i).check();

// The cart switched to the other drop in another tab while this page is
// open: the page follows, and the agreement for the first drop is cleared.
const other = await ctx.newPage();
await other.goto(`${APP}/games/${NEWER}`, { waitUntil: "networkidle" });
await other.locator(`[data-buy-drop="${NEWER}"]`).click();
await other.waitForTimeout(500);
await p.waitForTimeout(1500);
check("when another tab switches the cart to the other drop, checkout shows the new drop",
  (await p.locator("[data-checkout-drop-title]").innerText()) === NEWER_TITLE.toUpperCase());
check("and the drop terms and broadcast box are unticked, to be agreed again for that drop",
  !(await boxes.nth(1).isChecked()) && !(await boxes.nth(2).isChecked()) &&
    (await p.getByRole("button", { name: /Pay \$/ }).isDisabled()));
// Back to the older drop, and pay for it.
await other.goto(`${APP}/games/${OLDER}`, { waitUntil: "networkidle" });
await other.locator(`[data-buy-drop="${OLDER}"]`).click();
await other.waitForTimeout(500);
await other.close();
await p.waitForTimeout(1500);
await boxes.nth(1).check();
await boxes.nth(2).check();
check("checkout is back on the older drop", (await p.locator("[data-checkout-drop-title]").innerText()) === OLDER_TITLE.toUpperCase());
await p.getByRole("button", { name: /Pay \$/ }).click();
await p.waitForURL(/confirmation/, { timeout: 25000 }).catch(() => {});

// ------------------------------------------------------------ what was recorded
const d = await dump();
const order = d.orders.at(-1);
check("the order is recorded against the drop the buyer saw", order?.game_id === OLDER, order?.game_id);
const held = d.game_spots.filter((s) => s.order_id === order?.id);
check("its guide is in that drop and no other", held.length === 1 && held.every((s) => s.game_id === OLDER),
  JSON.stringify(held.map((s) => [s.game_id, s.spot_number])));
check("the other drop sold nothing", d.game_spots.filter((s) => s.game_id === NEWER && s.status !== "open").length === 0);

// ------------------------------------------------------------ the receipt and the email
check("the confirmation page names the drop",
  (await p.locator("[data-confirmation-drop-title]").innerText().catch(() => "")) === OLDER_TITLE.toUpperCase());
const receiptLinks = await p.locator("[data-confirmation-drop] a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
check("and links to that drop's own page", receiptLinks.length > 0 && receiptLinks.every((h) => h === `/games/${OLDER}`),
  JSON.stringify(receiptLinks));
const email = d.emails.find((e) => /dana\.ruiz/.test(JSON.stringify(e.to ?? e)));
const body = JSON.stringify(email ?? {});
check("the email names the drop", body.includes(`Your guides are for the drop: ${OLDER_TITLE}`), body.slice(0, 120));
check("and links to that drop's page, in both the HTML and the text",
  (body.match(new RegExp(`/games/${OLDER}`, "g")) ?? []).length >= 2);
check("and no longer says the draw can come early", !/or earlier if the shop decides/i.test(body));
check("no page errors", errors.length === 0, errors.join(" | "));

await b.close();
report();
