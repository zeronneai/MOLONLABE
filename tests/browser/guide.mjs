// The guide: what the customer is actually buying.
//
// The approved structure is that somebody buys a written guide to the
// piece and entry into the drawing comes with it. That only holds if the
// guide is a real document with the shop's own words in it, so the two
// halves of this suite are:
//
//   THE ADMIN WILL NOT PUBLISH WITHOUT IT. A game cannot be created — and
//   cannot be saved afterwards — with any of the three owner sections
//   empty or filled with "n/a". Creating a game opens it for sale in the
//   same breath, so creation IS publication and there is no draft to hold
//   an unfinished one in.
//
//   THE BUYER GETS IT. Built on the first purchase, linked from the
//   receipt and the email behind the same token the receipt uses,
//   rebuilt when the owner changes his words, and not rebuilt when he
//   changes nothing.
//
// The PDF is read back and asserted on as text — see tests/lib/pdf.mjs,
// which decodes it without poppler. Asserting that a PDF merely exists
// would pass just as well on a blank one.

import zlib from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { APP, CHROMIUM, DOUBLE, ROOT } from "../lib/config.mjs";
import {
  suite, reset, dump, storage, insert, update,
  page as newPage, adminPage, acceptStub, has,
} from "../lib/harness.mjs";
import { pdfFlatText, pdfPageCount, isPdf } from "../lib/pdf.mjs";

const { check, note, report } = suite();

const SEEDED_GAME = "55555555-5555-4555-8555-555555555555";
const PRIZE = "99999999-9999-4999-8999-999999999999";
// WEBP, not PNG, and that is the whole point of the fixture.
//
// The admin compresses client side before uploading to Supabase Storage,
// so every product photograph the shop has ever uploaded is a .webp —
// and react-pdf reads JPEG and PNG. The first deployed guide came out
// with no pictures in it at all, looking otherwise perfect. A PNG fixture
// passed that whole time.
const PHOTO = `${DOUBLE}/storage/v1/object/product-images/guide-test.webp`;
// A URL in the bucket with nothing behind it, for the shortfall below.
const MISSING_PHOTO = `${DOUBLE}/storage/v1/object/product-images/gone.webp`;

const GUIDE = {
  why: "I put this one up because it is the rifle I hand people when they ask what to buy once and never think about again.",
  care: "Wipe the bolt carrier down after every range trip and keep a light film of oil on the cam pin, and no more than that.",
  pairs: "An optic on the top rail, a two-point sling, and a can of decent lubricant. Nothing else needs buying on day one.",
};

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function shopper() {
  const page = await newPage(browser, { viewport: { width: 1280, height: 1000 } });
  await page.context().addInitScript(acceptStub(0), 0);
  await page.context().addInitScript(() => {
    localStorage.setItem("mlf_intro_seen", "1");
  });
  page.on("pageerror", (e) => check(`no page error`, false, e.message));
  return page;
}

/** A real WebP, made the way the admin makes one. */
async function webpBytes(width = 600, height = 400) {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 60, b: 90 } },
  })
    .webp()
    .toBuffer();
}

/** A small valid PNG, kept so both decode paths stay exercised. */
function pngBytes(width = 600, height = 400) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      raw[o++] = (x * 255) / width;
      raw[o++] = 60;
      raw[o++] = (y * 255) / height;
    }
  }
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await reset();

// A prize worth writing about: brand, description, specifications and a
// photograph, so the assembled half of the guide is exercised and not
// just the three typed sections.
const photoBytes = await webpBytes();
check("the fixture photograph really is a WebP",
  photoBytes.subarray(0, 4).toString() === "RIFF" &&
    photoBytes.subarray(8, 12).toString() === "WEBP",
  `${photoBytes.subarray(8, 12).toString()}, ${photoBytes.length} bytes`);
await fetch(PHOTO, {
  method: "POST",
  headers: { "content-type": "image/webp", "x-upsert": "true" },
  body: photoBytes,
});
await insert("items", {
  id: PRIZE,
  slug: "guide-test-rifle",
  name: "Daniel Defense DDM4 V7",
  category: "rifle",
  brand: "Daniel Defense",
  short_desc: "A 16-inch chrome-lined barrel, a free-float rail, and the trigger everybody else copies.",
  long_desc:
    "There is a reason this rifle turns up on every shortlist.\n\nThe barrel is cold hammer forged and chrome lined, which is the difference between a rifle that shoots well new and one that still shoots well after ten thousand rounds.",
  specs: { Caliber: "5.56 NATO", Barrel: "16 in, chrome lined", Weight: "6.3 lb" },
  price_display: "$1,899",
  fulfillment_type: "pickup",
  status: "available",
  images: [PHOTO],
});

// =====================================================================
// 1. The admin refuses to publish a game with no guide
// =====================================================================
const owner = await adminPage(browser, { viewport: { width: 1280, height: 1400 } });

async function fillNewGame({ why, care, pairs }) {
  await owner.goto(`${APP}/admin/games/new`, { waitUntil: "networkidle" });
  await owner.fill("#g-title", "October Rifle Game");
  await owner.selectOption("#g-item", PRIZE);
  await owner.fill("#g-spots", "50");
  await owner.fill("#g-price", "40.00");
  await owner.fill("#g-guide_why", why);
  await owner.fill("#g-guide_care", care);
  await owner.fill("#g-guide_pairs", pairs);
  await owner.getByRole("button", { name: /create and open/i }).click();
  await owner.waitForTimeout(900);
}

const gamesBefore = (await dump()).games.length;

// Empty.
await fillNewGame({ why: "", care: "", pairs: "" });
let body = await owner.locator("body").innerText();
check(
  "an empty guide stops the game being created",
  (await dump()).games.length === gamesBefore,
  `${(await dump()).games.length} game(s), was ${gamesBefore}`,
);
check(
  "and the admin says which section and why",
  has(body, "Why you chose this piece") && has(body, "paying for"),
  (body.match(/[^\n]*paying for[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 90),
);

// Filled in, but with nothing in it.
await fillNewGame({ why: "n/a", care: "n/a", pairs: "n/a" });
check(
  "'n/a' in all three is still refused",
  (await dump()).games.length === gamesBefore,
  `${(await dump()).games.length} game(s)`,
);
body = await owner.locator("body").innerText();
check(
  "and it says how short it is rather than just 'invalid'",
  /\b3 characters\b/.test(body) || has(body, "at least 40"),
  (body.match(/[^\n]*characters[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 90),
);

// Two of three. The one that would slip through a boolean check.
await fillNewGame({ why: GUIDE.why, care: GUIDE.care, pairs: "" });
check(
  "two of three is still not a guide",
  (await dump()).games.length === gamesBefore,
  `${(await dump()).games.length} game(s)`,
);

// All three.
await fillNewGame(GUIDE);
const games = (await dump()).games;
check("all three fills lets the game be created", games.length === gamesBefore + 1,
  `${games.length} game(s)`);

const game = games.find((g) => g.item_id === PRIZE);
check("the three sections are stored on the game",
  Boolean(game?.guide_why && game?.guide_care && game?.guide_pairs),
  game ? `${game.guide_why?.length}/${game.guide_care?.length}/${game.guide_pairs?.length} chars` : "no game");

// The game is open for sale from the moment it exists, which is exactly
// why the refusals above have to happen at creation.
check("the new game is open", game?.status === "open", game?.status);

// =====================================================================
// 2. Nothing has been rendered yet
// =====================================================================
check(
  "no guide is built until somebody buys — creating a game renders nothing",
  (await storage()).filter((o) => o.key.startsWith("game-guides/")).length === 0,
  JSON.stringify((await storage()).map((o) => o.key)),
);

// =====================================================================
// 3. The owner can look at what he is selling
// =====================================================================
const preview = await owner.request.get(`${APP}/admin/games/${game.id}/guide.pdf`);
const previewBody = Buffer.from(await preview.body());
check("the owner's preview returns a PDF", preview.status() === 200 && isPdf(previewBody),
  `${preview.status()}, ${previewBody.length} bytes`);

const text = pdfFlatText(previewBody);
check("the guide carries the piece's name", has(text, "Daniel Defense DDM4 V7"));
check("and the catalogue copy", has(text, "cold hammer forged"));
check("and the specifications", has(text, "5.56 NATO") && has(text, "Caliber"));
check("and all three of the owner's sections",
  has(text, "hand people when they ask") &&
    has(text, "light film of oil") &&
    has(text, "two-point sling"));
check("and their headings", has(text, "WHY THIS ONE") && has(text, "LOOKING AFTER IT"));
check("and the attorney's disclaimer, verbatim",
  has(text, "transferred through a federally licensed firearms dealer"));
note(`the guide is ${pdfPageCount(previewBody)} pages, ${previewBody.length} bytes`);

// The photograph, which went in as WebP and has to come out as JPEG —
// react-pdf reads JPEG and PNG, and the catalogue is all WebP. Looking
// for DCTDecode rather than just an image object, because "there is an
// image in here" would pass on a PNG fixture and that is exactly what it
// did while every real guide came out blank.
const previewRaw = previewBody.toString("latin1");
check("the WebP photograph is embedded, converted to JPEG",
  previewRaw.includes("/Subtype /Image") && previewRaw.includes("/DCTDecode"),
  previewRaw.includes("/Subtype /Image")
    ? previewRaw.includes("/DCTDecode")
      ? "image XObject, DCTDecode"
      : "an image, but NOT a JPEG"
    : "NO image XObject at all");

// And the shop has a record of what it managed, not just a log line.
const built = (await dump()).games.find((g) => g.id === game.id);
check("the build records how many photographs it got",
  built?.guide_images_wanted === 1 && built?.guide_images_used === 1,
  `${built?.guide_images_used} of ${built?.guide_images_wanted}`);

// The wording. The guide is about the piece and says nothing about what
// the purchase entitles anybody to — that wording is the attorney's and
// is not this document's to invent a fourth version of.
const forbidden = ["raffle", "lottery", "rifa", "sweepstake", "ticket",
  "odds", "entries", "chance to win", "you could win"];
const said = forbidden.filter((w) => has(text, w));
check("the guide describes the piece and nothing about the drawing",
  said.length === 0, said.join(", ") || "clean");

check("the owner's preview is not cached anywhere shared",
  (preview.headers()["cache-control"] ?? "").includes("no-store"),
  preview.headers()["cache-control"]);

// It was stored, not just streamed.
let stored = (await storage()).filter((o) => o.key.startsWith("game-guides/"));
check("the built guide is kept in the game-guides bucket",
  stored.length === 1 && stored[0].key === `game-guides/${game.id}.pdf`,
  stored.map((o) => o.key).join(", "));
check("and stored as a PDF", stored[0]?.contentType === "application/pdf",
  stored[0]?.contentType);

// =====================================================================
// 4. Not rebuilt when nothing changed
// =====================================================================
const firstDigest = stored[0].digest;
await owner.request.get(`${APP}/admin/games/${game.id}/guide.pdf`);
stored = (await storage()).filter((o) => o.key.startsWith("game-guides/"));
check("asking again does not rebuild it", stored[0].digest === firstDigest,
  `${firstDigest} then ${stored[0].digest}`);

// =====================================================================
// 5. Rebuilt when the owner changes his words
// =====================================================================
await owner.goto(`${APP}/admin/games/${game.id}`, { waitUntil: "networkidle" });
await owner.fill(
  "#g-guide_care",
  "Strip it every five hundred rounds, and keep the firing pin channel dry — oil there collects carbon and slows the pin.",
);
await owner.getByRole("button", { name: /save changes/i }).click();
await owner.waitForTimeout(900);

const edited = (await dump()).games.find((g) => g.id === game.id);
check("the edit saved", has(edited?.guide_care ?? "", "collects carbon"),
  (edited?.guide_care ?? "").slice(0, 50));

const after = await owner.request.get(`${APP}/admin/games/${game.id}/guide.pdf`);
const afterBody = Buffer.from(await after.body());
stored = (await storage()).filter((o) => o.key.startsWith("game-guides/"));
check("changing a section rebuilds the guide", stored[0].digest !== firstDigest,
  `${firstDigest} then ${stored[0].digest}`);
check("and the new words are in it", has(pdfFlatText(afterBody), "collects carbon"));
check("and the old ones are gone", !has(pdfFlatText(afterBody), "light film of oil"));
check("still one object, not a second copy", stored.length === 1,
  stored.map((o) => o.key).join(", "));

// An emptied section is refused on save too, or the rule would only
// apply to games that never existed.
await owner.goto(`${APP}/admin/games/${game.id}`, { waitUntil: "networkidle" });
await owner.fill("#g-guide_pairs", "");
await owner.getByRole("button", { name: /save changes/i }).click();
await owner.waitForTimeout(700);
const stillThere = (await dump()).games.find((g) => g.id === game.id);
check("a section cannot be emptied after the fact",
  Boolean(stillThere?.guide_pairs), stillThere?.guide_pairs?.slice(0, 40) ?? "EMPTIED");

// =====================================================================
// 6. The buyer's copy
// =====================================================================
// Put back to the state a never-built guide is in, so that the guide
// turning up after the purchase below is evidence the WARM-UP ran, and
// not evidence that section 3 already built one.
await fetch(`${DOUBLE}/storage/v1/object/game-guides/${game.id}.pdf`, {
  method: "DELETE",
});
await update("games", `id=eq.${game.id}`, {
  guide_path: null,
  guide_fingerprint: null,
});
check("the guide is cleared before the purchase",
  (await storage()).filter((o) => o.key.startsWith("game-guides/")).length === 0,
  JSON.stringify((await storage()).map((o) => o.key)));

const buyer = await shopper();
await buyer.goto(`${APP}/featured`, { waitUntil: "networkidle" });
await buyer.waitForTimeout(400);
await buyer.getByRole("button", { name: /^take /i }).click();
await buyer.waitForTimeout(500);
await buyer.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
await buyer.waitForTimeout(600);
await buyer.fill("#firstName", "Marisol");
await buyer.fill("#lastName", "Vega");
await buyer.fill("#email", "marisol.vega@example.com");
await buyer.fill("#cardNumber", "4111111111111111");
await buyer.fill("#cardMonth", "12");
await buyer.fill("#cardYear", "2029");
await buyer.fill("#cardCode", "123");
await buyer.fill("#cardZip", "79901");
for (const cb of await buyer.getByRole("checkbox").all()) {
  if (await cb.isVisible()) await cb.check().catch(() => {});
}
await buyer.getByRole("button", { name: /Pay \$/ }).click();
const paid = await buyer
  .waitForURL(/confirmation/, { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
check("the purchase completed", paid);

// The warm-up. It runs AFTER the response, so the receipt is already on
// screen — poll rather than assume, and keep the window short enough
// that "it eventually happened" cannot pass for "it happened".
let warmed = [];
for (let i = 0; i < 20 && warmed.length === 0; i++) {
  warmed = (await storage()).filter((o) => o.key.startsWith("game-guides/"));
  if (warmed.length === 0) await buyer.waitForTimeout(250);
}
check("buying warms the guide without anybody opening a link",
  warmed.length === 1, warmed.map((o) => `${o.key} ${o.bytes}b`).join(", ") || "never appeared");

const receipt = await buyer.locator("body").innerText();
check("the receipt offers the guide",
  has(receipt, "Open your guide") && has(receipt, "Daniel Defense DDM4 V7"),
  (receipt.match(/[^\n]*guide[^\n]*/i) ?? ["NOT OFFERED"])[0].slice(0, 80));

const href = await buyer
  .getByRole("link", { name: /open your guide/i })
  .getAttribute("href");
check("the receipt's link carries the order and the token",
  Boolean(href && /\/guide\/MLF-[A-Z0-9]+\.pdf\?t=/.test(href)),
  href ? href.replace(/t=.*/, "t=…") : "no link");

// Followed with nothing at all — no session, no cookie, no browser.
const customerCopy = await fetch(`${APP}${href}`);
const customerBytes = Buffer.from(await customerCopy.arrayBuffer());
check("the link opens the guide with no session of any kind",
  customerCopy.status === 200 && isPdf(customerBytes),
  `${customerCopy.status}, ${customerBytes.length} bytes`);
check("it is served as a PDF, inline, with a readable filename",
  (customerCopy.headers.get("content-disposition") ?? "").includes("daniel-defense"),
  customerCopy.headers.get("content-disposition"));
check("the customer's copy is the same document the owner previewed",
  pdfFlatText(customerBytes).includes("collects carbon"));

// =====================================================================
// 7. The token is the credential
// =====================================================================
const wrongToken = await fetch(`${APP}${href.replace(/t=.*/, "t=not-the-token")}`);
check("a wrong token gets nothing", wrongToken.status === 404, `${wrongToken.status}`);
check("and nothing that looks like a PDF",
  !isPdf(Buffer.from(await wrongToken.arrayBuffer())));

const wrongOrder = await fetch(`${APP}/guide/MLF-NOPE99.pdf${href.slice(href.indexOf("?"))}`);
check("a guessed order number gets nothing", wrongOrder.status === 404,
  `${wrongOrder.status}`);

// =====================================================================
// 8. The email says so, with a link and not an attachment
// =====================================================================
const mail = (await dump()).emails;
const last = mail[mail.length - 1] ?? {};
check("the confirmation email names the guide",
  has(last.html ?? "", "Your guide to the Daniel Defense DDM4 V7"),
  (String(last.text ?? "").match(/[^\n]*guide[^\n]*/i) ?? ["NOT NAMED"])[0].slice(0, 70));
check("the email links to it", has(last.html ?? "", "/guide/") && has(last.text ?? "", "/guide/"));
check("the email does NOT attach it",
  !("attachments" in last) && !has(last.html ?? "", "application/pdf"),
  Object.keys(last).join(", "));
check("the email stays under Gmail's 102KB clip",
  Buffer.byteLength(last.html ?? "") < 102_000,
  `${Buffer.byteLength(last.html ?? "")} bytes`);

// =====================================================================
// 9. A merchandise order has no guide
// =====================================================================
const shopperTwo = await shopper();
await shopperTwo.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
await shopperTwo.evaluate(
  (l) => localStorage.setItem("mlf_cart", JSON.stringify(l)),
  [{ itemId: "44444444-4444-4444-8444-444444444444", quantity: 1 }],
);
await shopperTwo.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
await shopperTwo.fill("#firstName", "Tomas");
await shopperTwo.fill("#lastName", "Ruiz");
await shopperTwo.fill("#email", "tomas.ruiz@example.com");
await shopperTwo.fill("#shipLine1", "1200 Texas Ave");
await shopperTwo.fill("#shipCity", "El Paso");
await shopperTwo.fill("#shipRegion", "TX");
await shopperTwo.fill("#shipPostalCode", "79901");
await shopperTwo.fill("#cardNumber", "4111111111111111");
await shopperTwo.fill("#cardMonth", "12");
await shopperTwo.fill("#cardYear", "2029");
await shopperTwo.fill("#cardCode", "123");
await shopperTwo.fill("#cardZip", "79901");
for (const cb of await shopperTwo.getByRole("checkbox").all()) {
  if (await cb.isVisible()) await cb.check().catch(() => {});
}
await shopperTwo.getByRole("button", { name: /Pay \$/ }).click();
await shopperTwo.waitForURL(/confirmation/, { timeout: 30000 }).catch(() => {});
const plainReceipt = await shopperTwo.locator("body").innerText();
check("a merchandise receipt offers no guide", !has(plainReceipt, "Open your guide"),
  (plainReceipt.match(/[^\n]*guide[^\n]*/i) ?? ["clean"])[0].slice(0, 60));

const plainOrder = (await dump()).orders.find((o) => o.email === "tomas.ruiz@example.com");
const noGuide = await fetch(
  `${APP}/guide/${plainOrder.order_number}.pdf?t=${plainOrder.confirmation_token}`,
);
check("and its guide URL is a 404 even with the right token",
  noGuide.status === 404, `${noGuide.status}`);

const plainMail = (await dump()).emails.at(-1);
check("its email says nothing about a guide",
  !has(plainMail?.text ?? "", "your guide"),
  (String(plainMail?.text ?? "").match(/[^\n]*guide[^\n]*/i) ?? ["clean"])[0].slice(0, 60));

// =====================================================================
// 10. A game whose prize has no copy at all still produces a guide
// =====================================================================
// The seeded rifle has no description and no specifications. The whole
// "what it is" section is suppressed rather than printed as a heading
// over an empty page — but the guide itself must still exist, because
// the owner's three sections are the part that was paid for.
const seededOrder = await fetch(`${DOUBLE}/rest/v1/orders`, {
  method: "POST",
  headers: { "content-type": "application/json", prefer: "return=representation" },
  body: JSON.stringify({
    order_number: "MLF-SPARSE", confirmation_token: "sparse-token",
    game_id: SEEDED_GAME, status: "paid", email: "sparse@example.com",
    first_name: "Ana", last_name: "Lopez", subtotal_cents: 3000, tax_cents: 0,
    shipping_cents: 0, total_cents: 3000, has_shipment: false, has_pickup: true,
    disclaimer_accepted_at: new Date().toISOString(),
  }),
}).then((r) => r.json());
const sparse = await fetch(`${APP}/guide/MLF-SPARSE.pdf?t=sparse-token`);
const sparseBytes = Buffer.from(await sparse.arrayBuffer());
check("a prize with no catalogue copy still gets a guide",
  sparse.status === 200 && isPdf(sparseBytes), `${sparse.status}`);
const sparseText = pdfFlatText(sparseBytes);
check("with the owner's sections in it", has(sparseText, "carried one of these for six years"));
check("and no empty 'what it is' heading over nothing",
  !has(sparseText, "WHAT IT IS"), "heading suppressed");
note(`sparse guide: ${pdfPageCount(sparseBytes)} pages`);
void seededOrder;

// =====================================================================
// 11. A game with no prize cannot produce one, and says so to the owner
// =====================================================================
await update("games", `id=eq.${SEEDED_GAME}`, { item_id: null });
const orphan = await owner.request.get(`${APP}/admin/games/${SEEDED_GAME}/guide.pdf`);
check("a game with no prize tells the owner why, rather than 500ing",
  orphan.status() === 409 && has(await orphan.text(), "no prize"),
  `${orphan.status()} — ${(await orphan.text()).slice(0, 60)}`);

// =====================================================================
// 12. The words are not given away on the way in
// =====================================================================
// The three sections are the part somebody pays for. `getCurrentGame`
// and `getAllGames` both select * from games, so they now carry these
// columns — and a page that hands its whole game row to a client
// component would put the paid content in the markup of a free page.
// Checked against the raw HTML rather than the rendered text, because
// serialised props are in the source and not on the screen.
// =====================================================================
// 13. A guide that came out short says so
// =====================================================================
// The worst outcome this system can produce is a guide that renders
// beautifully with blank space where the photographs should be: it looks
// finished, so nobody finds out until a customer who paid for it does.
// It shipped that way once. The shortfall is now recorded against the
// game and shown to the owner.
//
// It is NOT a refusal. A prize with no photographs at all is legitimate
// — the three written sections are what is being sold — and refusing
// would trade "a guide with no pictures" for "no guide", which is worse
// for somebody who has already paid.
{
  // Two photographs, one of which is not there.
  await update("items", `id=eq.${PRIZE}`, { images: [PHOTO, MISSING_PHOTO] });

  const short = await owner.request.get(`${APP}/admin/games/${game.id}/guide.pdf`);
  check("a guide with an unreachable photograph is still produced",
    short.status() === 200 && isPdf(Buffer.from(await short.body())),
    `${short.status()}`);

  const row = (await dump()).games.find((g) => g.id === game.id);
  check("and the shortfall is recorded against the game",
    row?.guide_images_wanted === 2 && row?.guide_images_used === 1,
    `${row?.guide_images_used} of ${row?.guide_images_wanted}`);

  await owner.goto(`${APP}/admin/games/${game.id}`, { waitUntil: "networkidle" });
  const adminText = await owner.locator("body").innerText();
  check("and the admin says so where the owner will see it",
    /1 of 2\s+photographs/i.test(adminText.replace(/\s+/g, " ")),
    (adminText.match(/[^\n]*came out with[^\n]*/i) ?? ["NOT SAID"])[0].slice(0, 90),
  );
  check("and offers a way to try again",
    (await owner.getByRole("link", { name: /build it again/i }).count()) > 0);

  // Now put the missing photograph where it belongs. The item's image
  // URLs have NOT changed, so the fingerprint is identical and an
  // ordinary open would serve the short guide for ever — which is the
  // whole reason the rebuild link exists.
  await fetch(MISSING_PHOTO, {
    method: "POST",
    headers: { "content-type": "image/webp", "x-upsert": "true" },
    body: await webpBytes(400, 300),
  });

  await owner.request.get(`${APP}/admin/games/${game.id}/guide.pdf`);
  const stillShort = (await dump()).games.find((g) => g.id === game.id);
  check("opening it again does NOT pick the photograph up — inputs unchanged",
    stillShort?.guide_images_used === 1,
    `${stillShort?.guide_images_used} of ${stillShort?.guide_images_wanted}`);

  await owner.request.get(`${APP}/admin/games/${game.id}/guide.pdf?rebuild=1`);
  const rebuilt = (await dump()).games.find((g) => g.id === game.id);
  check("rebuilding does",
    rebuilt?.guide_images_wanted === 2 && rebuilt?.guide_images_used === 2,
    `${rebuilt?.guide_images_used} of ${rebuilt?.guide_images_wanted}`);

  await owner.goto(`${APP}/admin/games/${game.id}`, { waitUntil: "networkidle" });
  const afterText = await owner.locator("body").innerText();
  check("and the warning is gone",
    !has(afterText, "came out with"),
    (afterText.match(/[^\n]*Last built[^\n]*/i) ?? ["no line at all"])[0].slice(0, 60));

  // Put the item back for anything after this.
  await update("items", `id=eq.${PRIZE}`, { images: [PHOTO] });
}

// =====================================================================
// 14. The money path does not import the renderer
// =====================================================================
// Read from the source, because this cannot be observed from the outside
// and it is the guard that a live checkout already paid for.
//
// Importing @react-pdf/renderer is not inert: when pdfkit's font files
// are missing from a deployment it throws four unhandled promise
// rejections at module scope, attached to no promise anybody can await.
// No try/catch reaches that, and a serverless runtime may kill the
// invocation over it — which is why the one action that charges cards
// must not have the renderer in its module graph at all. The warm-up
// uses a dynamic import, after the response.
{
  const source = readFileSync(join(ROOT, "app/actions/checkout.ts"), "utf8");
  const staticImports = [...source.matchAll(/^import[^;]*?from\s+"([^"]+)"/gm)].map(
    (m) => m[1],
  );
  const offenders = staticImports.filter(
    (m) => m.includes("guides/build") || m.includes("react-pdf"),
  );
  check("checkout has no static import of the PDF renderer",
    offenders.length === 0, offenders.join(", ") || "clean");
  check("and reaches it through a dynamic import instead",
    /await import\(\s*"@\/lib\/guides\/build"\s*\)/.test(source),
    (source.match(/await import\([^)]*\)/) ?? ["NOT FOUND"])[0]);
  check("and only after the response has gone",
    /afterResponse\(/.test(source),
    (source.match(/[^\n]*afterResponse\([^\n]*/) ?? ["NOT DEFERRED"])[0].trim().slice(0, 50));
  // The same search, pointed at a file that DOES import it, so a clean
  // result above cannot come from a broken regex.
  const route = readFileSync(join(ROOT, "app/guide/[order]/route.ts"), "utf8");
  check("the same search finds the import where it belongs",
    /^import[^;]*?from\s+"@\/lib\/guides\/build"/m.test(route),
    "app/guide/[order]/route.ts");
}

const NEEDLE = GUIDE.why.slice(0, 60);
for (const path of ["/featured", "/games"]) {
  const html = await (await fetch(`${APP}${path}`)).text();
  const leaked = [GUIDE.why, GUIDE.pairs, "guide_why", "guide_care", "guide_pairs"]
    .filter((needle) => has(html, needle.slice(0, 60)));
  check(`${path} does not ship the guide's words to the browser`,
    leaked.length === 0, leaked.map((l) => l.slice(0, 30)).join(" / ") || "clean");
}
// The same needle, on the one page where it MUST appear. Without this
// the two assertions above would pass just as happily against a typo in
// the needle, a 404, or a page that failed to render at all.
const ownerHtml = await (await owner.request.get(`${APP}/admin/games/${game.id}`)).text();
check("the same search finds it where it is supposed to be",
  has(ownerHtml, NEEDLE), `looked for "${NEEDLE.slice(0, 30)}…" in the admin form`);

await browser.close();
report();
