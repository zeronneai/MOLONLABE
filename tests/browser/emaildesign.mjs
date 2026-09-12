import { chromium } from "playwright";
import { CHROMIUM } from "../lib/config.mjs";
import { placeMixedOrder } from "../lib/mixedOrder.mjs";

// The email is placed FRESH, here, every run. It used to be read from
// files another test had written, which made this depend on run order
// and — worse — let it pass against an email left on disk by a previous
// version of the app. Two assertions did exactly that for months.
const { html, text, notifications: notes } = await placeMixedOrder();

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);
const has = (h, n) => String(h).includes(n);

// ------------------------------------------------- email HTML discipline
check("under Gmail's 102KB clip threshold",
  Buffer.byteLength(html) < 102 * 1024,
  `${(Buffer.byteLength(html) / 1024).toFixed(1)}KB`);
check("no flexbox or grid", !/display\s*:\s*(flex|grid)/i.test(html));
check("no background images", !/background-image/i.test(html));
check("layout tables are hidden from screen readers",
  (html.match(/<table/g) ?? []).length ===
    (html.match(/role="presentation"/g) ?? []).length,
  `${(html.match(/<table/g) ?? []).length} tables, ${(html.match(/role="presentation"/g) ?? []).length} marked`);
check("every table sets cellpadding/cellspacing/border",
  (html.match(/<table/g) ?? []).length ===
    (html.match(/cellpadding="0" cellspacing="0" border="0"/g) ?? []).length);
check("declares a colour scheme so clients stop force-inverting",
  has(html, 'name="color-scheme"') && has(html, 'name="supported-color-schemes"'));
check("carries Outlook.com dark-theme overrides", has(html, "[data-ogsc]"));
check("has a preheader for the inbox list", has(html, "max-height:0"));
check("asks Apple Mail not to reformat",
  has(html, "x-apple-disable-message-reformatting"));
// "sans-serif" is fine; a bare serif family in the chain is not.
const serifFallback = /font-family:[^;"]*(?<!sans-)\b(serif|Georgia|Times|Garamond)\b/i;
check("Archivo requested, with a sans fallback and no serif in the chain",
  has(html, "Archivo") && has(html, "Helvetica") && !serifFallback.test(html));
check("the logo is decorative, so blocked images leave no alt block",
  has(html, 'alt=""'));
check("the logo has explicit dimensions so layout does not jump",
  /<img[^>]+width="72"[^>]+height="72"/.test(html));
check("the wordmark is text, so a blocked logo still names the shop",
  has(html, "MOLON LABE FIREARMS X SUNCITY OUTDOORS") ||
    has(html, "Molon Labe Firearms x SunCity Outdoors"));

// ------------------------------------------------------ brand and content
check("ink page ground", has(html, "#0b0a0c"));
check("bone text", has(html, "#f2efe7"));
check("acid is present", has(html, "#57b94a"));
// The only accent: no other saturated colour beyond acid and the reserved
// amber for collection.
const hexes = [...new Set((html.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()))];
const allowed = ["#0b0a0c", "#131417", "#1b1d21", "#f2efe7", "#9a9b9f", "#57b94a", "#c08a2e", "#2a2c30"];
check("no colour outside the system", hexes.every((h) => allowed.includes(h)),
  hexes.filter((h) => !allowed.includes(h)).join(", ") || "none");

for (const [label, needle] of [
  ["the order number", "MLF-"],
  ["what ships", "Shipping to you"],
  ["what is collected", "Collect at the shop"],
  ["the size on a sized line", "Size Medium"],
  ["the totals", "Subtotal"],
  ["the receipt link", "/checkout/confirmation?order="],
  ["the attorney's text", "federally licensed"],
  ["the no-refunds line", "No refunds or exchanges"],
  ["the address", "10024 Montana Ave"],
  ["the phone", "(915) 497-0541"],
]) check(`the HTML carries ${label}`, has(html, needle));

// Ordinary merchandise earns nothing under the fixed-pool model, so the
// receipt must say nothing about entries. This replaced two assertions
// that looked for an entry count: they were left behind by the rebuild
// and went on passing because this file reads artifacts from disk and
// the ones on disk were older than the rebuild.
check("a merchandise receipt says nothing about entries",
  !/entr(y|ies)|This order earned/i.test(html) && !/entr(y|ies)/i.test(text),
  (html.match(/[^<>]*entr[^<>]*/i) ?? text.match(/[^\n]*entr[^\n]*/i) ?? ["clean"])[0].trim().slice(0, 80));

// ------------------------------------------------------------ plain text
check("the text part is substantial, not a stub",
  text.length > 1200, `${text.length} chars`);
for (const [label, needle] of [
  ["the order number", "MLF-"],
  ["a shipping section", "SHIPPING TO YOU"],
  ["a collection section", "COLLECT AT THE SHOP"],
  ["the size", "Size Medium"],
  ["aligned totals", "  TOTAL"],
  ["the receipt link", "/checkout/confirmation?order="],
  ["the attorney's text", "federally licensed"],
  ["the address", "10024 Montana Ave"],
]) check(`the text part carries ${label}`, has(text, needle));
check("the text part has no HTML in it", !/<[a-z/]/i.test(text));
check("money columns line up",
  text.split("\n").filter((l) => /\$/.test(l) && /^\s{2}\S/.test(l))
    .every((l) => l.length <= 56),
  "lines within 56 columns");

// -------------------------------------------------- how clients break it
// Written to a temp file this run owns, rather than an artifact some
// other test left behind. setContent would be simpler but loses the
// document context that `prefers-color-scheme` and the <style> block
// need to behave the way a mail client makes them behave.
const { writeFileSync, mkdtempSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { join: joinPath } = await import("node:path");
const scratch = joinPath(mkdtempSync(joinPath(tmpdir(), "mlf-email-")), "email.html");
writeFileSync(scratch, html);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
const page = await ctx.newPage();
await page.goto(`file://${scratch}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);

// Contrast, measured rather than assumed, on the elements that carry text.
const contrast = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bgOf = (el) => {
    let n = el;
    while (n) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
      n = n.parentElement;
    }
    return "rgb(255,255,255)";
  };
  const out = [];
  for (const el of document.querySelectorAll("p,h1,td,span,a,strong")) {
    const t = (el.textContent ?? "").trim();
    if (!t || el.children.length > 0) continue;
    const s = getComputedStyle(el);
    const a = lum(s.color), b = lum(bgOf(el));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    out.push({ text: t.slice(0, 32), ratio: Number(ratio.toFixed(2)), size: s.fontSize });
  }
  return out;
});
const worst = contrast.sort((a, b) => a.ratio - b.ratio)[0];
check("every line of text clears 4.5:1 on its own background",
  contrast.every((c) => c.ratio >= 4.5),
  worst ? `worst ${worst.ratio}:1 — "${worst.text}"` : "nothing measured");

// A client that drops the <style> block entirely. Everything that matters
// is inline, so nothing should change.
const stripped = html.replace(/<style>[\s\S]*?<\/style>/g, "");
await page.setContent(stripped, { waitUntil: "domcontentloaded" });
const noStyleBg = await page.evaluate(
  () => getComputedStyle(document.querySelector(".ml-card")).backgroundColor,
);
check("the card stays dark with the <style> block stripped",
  noStyleBg === "rgb(19, 20, 23)", noStyleBg);

// A client that drops the body background — the classic way a dark email
// turns into light text on white.
await page.setContent(html.replace(/<body[^>]*>/, "<body>"), {
  waitUntil: "domcontentloaded",
});
const orphanBg = await page.evaluate(
  () => getComputedStyle(document.querySelector(".ml-card")).backgroundColor,
);
check("the card carries its own background, not the body's",
  orphanBg === "rgb(19, 20, 23)", orphanBg);

await browser.close();

// ------------------------------------------------- the owner's summaries
const order = notes.find((n) => n.kind === "order");
check("the order notification carries a summary", typeof order?.summary === "string");
check("the summary keeps the structured fields beside it",
  Array.isArray(order?.ships) && typeof order?.total_cents === "number");
const s = order?.summary ?? "";
for (const [label, needle] of [
  ["a headline with the order number", "NEW ORDER — MLF-"],
  ["who it was", "Dana Ruiz · dana.ruiz@example.com"],
  ["what is collected", "COLLECT AT SHOP"],
  ["what ships", "SHIPS"],
  ["the size on the shipped line", "Molon Labe Tee, Medium"],
  ["money as money", "Subtotal $2,231.00"],
  ["the card", "Visa ending 1111"],
  ["the standing instruction", "Background check due at pickup."],
]) check(`the order summary has ${label}`, has(s, needle), needle);
check("the summary is plain text, ready to print", !/<[a-z/]/i.test(s));

const inquiry = notes.find((n) => n.kind === "inquiry");
if (inquiry) {
  check("the inquiry summary names the kind of request",
    has(inquiry.summary ?? "", "FFL TRANSFER REQUEST") ||
      has(inquiry.summary ?? "", "ENQUIRY") ||
      has(inquiry.summary ?? "", "MESSAGE"),
    (inquiry.summary ?? "").split("\n")[0]);
}

for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length === 0 ? 0 : 1);
