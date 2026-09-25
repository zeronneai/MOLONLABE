// What people actually read, read back for four words.
//
// The attorney's ruling: what a customer buys is a guide to the featured
// piece, and entry into the drawing comes with it. "Spot", "ticket",
// "raffle" and "lottery" describe a different legal product and may not
// appear anywhere a customer or member of staff can read them.
//
// scripts/check-copy.mjs enforces that on the SOURCE at build time. This
// enforces it on the ARTIFACTS: every rendered page, as a customer, as
// the owner and as the manager, including page titles, meta tags, alt
// text, labels and anything hidden until a menu opens; the confirmation
// email as it was sent; the owner's alerts; the guide PDF's own text;
// and the draw presentation, sampled all the way through every phase in
// both orientations, because that is filmed and posted.
//
// A source check can be satisfied by a string assembled at run time from
// data. This cannot.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, ARTIFACTS, DOUBLE } from "../lib/config.mjs";
import {
  adminPage,
  browser,
  dump,
  managerPage,
  throughRoster,
  page as newPage,
  reset,
  suite,
} from "../lib/harness.mjs";
import { pdfText } from "../lib/pdf.mjs";

const { check, note, report } = suite();
const BANNED = /\b(spots?|tickets?|raffles?|lotter(?:y|ies))\b/gi;
const GAME = "55555555-5555-4555-8555-555555555555";
const SHOTS = join(ARTIFACTS, "wording");
mkdirSync(SHOTS, { recursive: true });

/** Every hit, as "surface: …context…". Empty is the pass. */
const found = (surface, text) =>
  [...String(text).matchAll(BANNED)].map((m) => {
    const at = m.index ?? 0;
    return `${surface}: …${String(text).slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, " ")}…`;
  });

/**
 * Everything on a page a person can read or hear: the visible text, the
 * text of anything hidden until opened, the title, every meta tag's
 * content, and the attributes a screen reader or a hover speaks.
 */
async function readable(p) {
  return p.evaluate(() => {
    const clone = document.body.cloneNode(true);
    for (const el of clone.querySelectorAll("script, style, noscript, template")) el.remove();
    const attrs = [...document.querySelectorAll("[title], [aria-label], [alt], [placeholder]")]
      .flatMap((el) => ["title", "aria-label", "alt", "placeholder"].map((a) => el.getAttribute(a) ?? ""));
    const metas = [...document.querySelectorAll("meta[content]")]
      .filter((m) => /description|title|og:|twitter:/i.test(m.getAttribute("name") ?? m.getAttribute("property") ?? ""))
      .map((m) => m.getAttribute("content"));
    return [document.title, ...metas, ...attrs, clone.textContent].join("\n");
  });
}

const hits = [];
async function sweep(p, surface, path) {
  const res = await p.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(250);
  hits.push(...found(`${surface} ${path}`, await readable(p)));
  return res?.status();
}

await reset();
const b = await browser();

// ====================================================================
// CUSTOMER
// ====================================================================
const c = await newPage(b, { viewport: { width: 1280, height: 1200 } });
await c.context().addInitScript(() => {
  window.Accept = {
    dispatchData: (_d, h) => h({
      messages: { resultCode: "Ok", message: [] },
      opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "NONCE-OK" },
    }),
  };
});

for (const path of [
  "/", "/games", "/featured", "/shop", "/in-the-case", "/transfers", "/services",
  "/visit", "/privacy", "/sweepstakes-rules", "/inventory/sig-mpx-carbon",
  "/inventory/molon-labe-tee", "/cart", "/no-such-page",
]) {
  await sweep(c, "PUBLIC", path);
}

// The mobile menu, opened, since its text is only in the DOM once open.
const phone = await newPage(b, { viewport: { width: 390, height: 844 } });
await phone.goto(`${APP}/`, { waitUntil: "networkidle" });
const menu = phone.getByRole("button", { name: /menu/i }).first();
if (await menu.count()) await menu.click().catch(() => {});
await phone.waitForTimeout(300);
hits.push(...found("PUBLIC mobile menu", await readable(phone)));

// Buy two guides, all the way through.
await c.goto(`${APP}/featured`, { waitUntil: "networkidle" });
await c.fill("#guide-count", "2");
check("the buy control reads as buying a guide",
  (await c.getByRole("button", { name: "Get 2 guides" }).count()) === 1,
  await c.getByRole("button", { name: /^Get/ }).first().innerText().catch(() => "none"));
await c.getByRole("button", { name: /^Get/ }).click();
await c.waitForTimeout(600);
hits.push(...found("PUBLIC /featured after adding", await readable(c)));
await sweep(c, "PUBLIC", "/cart");
await sweep(c, "PUBLIC", "/checkout");
for (const [k, v] of [
  ["#firstName", "Dana"], ["#lastName", "Ruiz"], ["#email", "dana.ruiz@example.com"],
  ["#cardNumber", "4111111111111111"], ["#cardMonth", "12"], ["#cardYear", "2029"],
  ["#cardCode", "123"], ["#cardZip", "79901"],
]) if (await c.locator(k).count()) await c.fill(k, v);
const boxes = c.getByRole("checkbox");
for (let i = 0; i < (await boxes.count()); i += 1) await boxes.nth(i).check();
await c.getByRole("button", { name: /Pay \$/ }).click();
await c.waitForURL(/confirmation/, { timeout: 25000 }).catch(() => {});
await c.waitForTimeout(1500);
const receipt = await readable(c);
hits.push(...found("PUBLIC confirmation page", receipt));
check("the confirmation page names the guide numbers",
  /guide numbers\s*1, 2/i.test(receipt.replace(/\s+/g, " ")),
  (receipt.match(/[^\n]*guide number[^\n]*/i) ?? ["NOT SHOWN"])[0].slice(0, 80));

let d = await dump();
const order = d.orders[0];
check("the order went through", Boolean(order), d.orders.length ? "" : "no order");

// The email, exactly as it was handed to the transport.
const email = d.emails.find((e) => e.kind === "order_confirmation");
check("a confirmation email was sent", Boolean(email));
hits.push(...found("EMAIL subject", email?.subject ?? ""));
hits.push(...found("EMAIL html", String(email?.html ?? "").replace(/<[^>]+>/g, " ")));
hits.push(...found("EMAIL text", email?.text ?? ""));

// The owner's alerts.
for (const n of d.notifications) {
  hits.push(...found(`ALERT ${n.kind} subject`, n.subject ?? ""));
  hits.push(...found(`ALERT ${n.kind} summary`, n.summary ?? ""));
}

// The guide itself, as the customer's link serves it.
const guideHref = await c.locator('a[href*="/guide/"]').first().getAttribute("href").catch(() => null);
if (guideHref) {
  const res = await c.request.get(new URL(guideHref, APP).toString());
  const buf = Buffer.from(await res.body());
  const text = pdfText(buf);
  check("the guide PDF was produced and read", res.status() === 200 && text.length > 200,
    `${res.status()}, ${text.length} characters`);
  hits.push(...found("GUIDE PDF", text));
} else {
  check("the confirmation page links the guide", false, "no /guide/ link found");
}

// The stored order line. Not rewritten after the fact, so it must be
// right when it is written.
hits.push(...found("ORDER line as stored", d.order_items.map((l) => l.name).join("\n")));

// Sell the rest so the drop fills and the sold-out alert goes out.
await c.goto(`${APP}/featured`, { waitUntil: "networkidle" });
await c.fill("#guide-count", "3");
await c.getByRole("button", { name: /^Get/ }).click();
await c.waitForTimeout(600);
await c.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
for (const [k, v] of [
  ["#firstName", "Ana"], ["#lastName", "Lopez"], ["#email", "ana@example.com"],
  ["#cardNumber", "4111111111111111"], ["#cardMonth", "12"], ["#cardYear", "2029"],
  ["#cardCode", "123"], ["#cardZip", "79901"],
]) if (await c.locator(k).count()) await c.fill(k, v);
for (let i = 0; i < (await c.getByRole("checkbox").count()); i += 1) await c.getByRole("checkbox").nth(i).check();
await c.getByRole("button", { name: /Pay \$/ }).click();
await c.waitForURL(/confirmation/, { timeout: 25000 }).catch(() => {});
await c.waitForTimeout(1500);
d = await dump();
const full = d.notifications.find((n) => n.kind === "game_full");
check("the sold-out alert went out", Boolean(full));
hits.push(...found("ALERT game_full", `${full?.subject}\n${full?.summary}`));
for (const path of ["/", "/games", "/featured"]) await sweep(c, "PUBLIC sold out", path);

// The rules: what is not settled is marked, not guessed at. Eight left
// after the client's edits of 2026-09-25 (tests/browser/rules.mjs names them).
await c.goto(`${APP}/sweepstakes-rules`, { waitUntil: "networkidle" });
const pendingCount = await c.locator("[data-pending-wording]").count();
check("the rules page marks the clauses still to be confirmed", pendingCount === 7, `${pendingCount}`);

// ====================================================================
// STAFF
// ====================================================================
const ADMIN = [
  "/admin/inventory", "/admin/inventory/33333333-3333-4333-8333-333333333333",
  "/admin/games", `/admin/games/${GAME}`, "/admin/games/new", "/admin/orders",
  "/admin/inquiries", "/admin/game", "/admin/commerce", "/admin/activity", "/admin/team",
];
const owner = await adminPage(b, { viewport: { width: 1280, height: 1200 } });
for (const path of ADMIN) await sweep(owner, "OWNER", path);
const manager = await managerPage(b, { viewport: { width: 1280, height: 1200 } });
for (const path of ADMIN) await sweep(manager, "MANAGER", path);

// The buyer list download, which staff open in a spreadsheet.
const csv = await owner.request.get(`${APP}/admin/games/${GAME}/guides.csv`);
const csvText = await csv.text();
hits.push(...found("CSV export", csvText));
check("the export has one heading per column",
  csvText.split("\r\n").every((row, _i, rows) =>
    row.split('","').length === rows[0].split('","').length),
  csvText.split("\r\n").slice(0, 2).join(" | ").slice(0, 120));
const disposition = csv.headers()["content-disposition"] ?? "";
hits.push(...found("CSV filename", disposition));

// ====================================================================
// THE DRAW, FRAME BY FRAME
// ====================================================================
// Sampled every 150 ms from the moment Start is pressed until the result
// has locked, so the tiles filling, every name that flashes past in the
// spin, and the final record are all read. Screenshots of each phase go
// to the artifacts folder for a human to look at as well.
const ORIENTATIONS = [
  { label: "9x16", button: "9:16", viewport: { width: 540, height: 960 } },
  { label: "16x9", button: "16:9", viewport: { width: 1280, height: 720 } },
];
let frames = 0;
for (const o of ORIENTATIONS) {
  const p = await adminPage(b, { viewport: o.viewport });
  await p.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: o.button }).click();
  await p.waitForTimeout(300);
  hits.push(...found(`DRAW ${o.label} setup`, await readable(p)));
  await p.screenshot({ path: join(SHOTS, `draw-${o.label}-1-setup.png`) });

  await p.getByRole("button", { name: /start the draw|replay the draw/i }).click();
  await p.locator("[data-roster-page]").waitFor();
  hits.push(...found(`DRAW ${o.label} roster`, await readable(p)));
  await p.screenshot({ path: join(SHOTS, `draw-${o.label}-2-roster.png`) });
  const { rows } = await throughRoster(p);
  check(`DRAW ${o.label}: the roster was read before the spin`, rows.length > 0, `${rows.length} rows`);
  const seen = new Set();
  const shotAt = { 1500: "3-spin-early", 5000: "3-spin-late" };
  for (let t = 0; t <= 9500; t += 150) {
    const text = await p.evaluate(() => document.body.innerText);
    seen.add(text);
    frames += 1;
    for (const [ms, name] of Object.entries(shotAt)) {
      if (t >= Number(ms) && t < Number(ms) + 150) {
        await p.screenshot({ path: join(SHOTS, `draw-${o.label}-${name}.png`) });
      }
    }
    await p.waitForTimeout(150);
  }
  for (const text of seen) hits.push(...found(`DRAW ${o.label} during`, text));
  await p.waitForTimeout(500);
  const locked = await readable(p);
  hits.push(...found(`DRAW ${o.label} result`, locked));
  await p.screenshot({ path: join(SHOTS, `draw-${o.label}-4-result.png`) });
  check(`DRAW ${o.label}: the result names the winning guide`,
    /winning guide\s*#\d+/i.test(locked), (locked.match(/[^\n]*winning guide[^\n]*/i) ?? ["NOT SHOWN"])[0]);
  check(`DRAW ${o.label}: the spin was sampled`, seen.size > 3, `${seen.size} distinct frames`);

  // The summary the owner copies to post with the video.
  await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP });
  await p.mouse.move(10, 10);
  const copy = p.getByRole("button", { name: /copy summary/i });
  if (await copy.count()) {
    await copy.click().catch(() => {});
    await p.waitForTimeout(300);
    const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    check(`DRAW ${o.label}: the copied summary was read`, clip.length > 20, clip.slice(0, 60));
    hits.push(...found(`DRAW ${o.label} copied summary`, clip));
    check(`DRAW ${o.label}: the summary says what each guide was`,
      /every guide was one entry/i.test(clip), clip.split("\n").find((l) => /entry/i.test(l)) ?? "");
  }
}
note(`${frames} draw frames sampled; screenshots in ${SHOTS}`);

// Rehearsal pool, which uses its own invented names.
{
  const p = await adminPage(b, { viewport: { width: 540, height: 960 } });
  await p.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Rehearsal" }).click();
  await p.getByRole("button", { name: /start rehearsal/i }).click();
  const seen = new Set();
  seen.add(await p.evaluate(() => document.body.innerText));
  await throughRoster(p);
  for (let t = 0; t <= 12000; t += 300) {
    seen.add(await p.evaluate(() => document.body.innerText));
    await p.waitForTimeout(300);
  }
  for (const text of seen) hits.push(...found("DRAW rehearsal", text));
}

// After the draw, the public record.
for (const path of ["/", "/games", "/featured"]) await sweep(c, "PUBLIC drawn", path);
for (const path of [`/admin/games/${GAME}`, "/admin/activity"]) await sweep(owner, "OWNER drawn", path);

// ====================================================================
const unique = [...new Set(hits)];
check("no customer or staff surface says spot, ticket, raffle or lottery",
  unique.length === 0, unique.slice(0, 12).join("\n      "));
if (unique.length > 12) note(`${unique.length - 12} more`);

await b.close();
report();
