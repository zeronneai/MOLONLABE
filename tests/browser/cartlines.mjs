// The cart, line by line, on a phone.
//
// Every line gets a small square picture, and never a broken image or an
// empty box. A guide shows its drop's featured piece; a shop item its own
// photo; anything without one, or whose photo fails to load, the shop's
// placeholder. Beside it: the name, the quantity, the line price, the
// size for apparel, the drop for a guide. Quantity and remove on each
// line, with the figures changing the moment they are tapped.
//
// The pictures are served by the test (Playwright answers the image
// optimiser's URLs), so "a photo that loads" and "a photo that fails" are
// both real outcomes here rather than whatever the network does today.

import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { join } from "node:path";
import { APP, ARTIFACTS } from "../lib/config.mjs";
import { browser, insert, page as newPage, reset, suite, update } from "../lib/harness.mjs";

const { check, report } = suite();
const SHOTS = join(ARTIFACTS, "cartlines");
mkdirSync(SHOTS, { recursive: true });

const GAME = "55555555-5555-4555-8555-555555555555";
const RIFLE = "11111111-1111-4111-8111-111111111111";
const OPTIC = "22222222-2222-4222-8222-222222222222";
const SHIRT = "33333333-3333-4333-8333-333333333333";
const V_S = "aaaaaaaa-0000-4000-8000-000000000001";
const BAG = "99999999-0000-4000-8000-0000000000b1";
const GOOD = "https://res.cloudinary.com/dsprn0ew4/image/upload/v1/test/rifle-good.jpg";
const BROKEN = "https://res.cloudinary.com/dsprn0ew4/image/upload/v1/test/tee-gone.jpg";
// A real picture for the photo that loads: a 96px square in the shop's green.
const PNG = await sharp({ create: { width: 96, height: 96, channels: 3, background: "#58b947" } }).png().toBuffer();

await reset();
await update("items", `id=eq.${RIFLE}`, { images: [GOOD] });
await update("items", `id=eq.${SHIRT}`, { images: [BROKEN] });
await update("items", `id=eq.${OPTIC}`, { images: [] });
await insert("items", {
  id: BAG, slug: "range-bag", name: "Range Bag With A Deliberately Long Name For A Phone", category: "accessory",
  brand: null, short_desc: null, long_desc: null, specs: {}, price_display: "$85", price_cents: 8500,
  fulfillment_type: "pickup", shipping_tier: "standard", has_variants: false, status: "available",
  is_featured: false, sort_order: 9, images: [], video_url: null,
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
});

const b = await browser();
const p = await newPage(b, { viewport: { width: 390, height: 844 } });
// The image optimiser's URLs: the good photo loads, the broken one fails.
await p.route("**/_next/image**", (route) => {
  const src = decodeURIComponent(new URL(route.request().url()).searchParams.get("url") ?? "");
  if (src === GOOD) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
  return route.fulfill({ status: 404, body: "" });
});

await p.goto(`${APP}/shop`, { waitUntil: "domcontentloaded" });
await p.evaluate((cart) => localStorage.setItem("mlf_cart", JSON.stringify(cart)), [
  { gameId: GAME, quantity: 2 },
  { itemId: SHIRT, variantId: V_S, quantity: 1 },
  { itemId: OPTIC, quantity: 1 },
  { itemId: BAG, quantity: 1 },
]);
await p.goto(`${APP}/cart`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);

const line = (key) => p.locator(`[data-cart-line="${key}"]`);
const guide = line(`game:${GAME}`);
const tee = line(`${SHIRT}:${V_S}`);
const optic = line(`${OPTIC}:`);
const bag = line(`${BAG}:`);

check("all four lines are listed, the guide among them", (await p.locator("[data-cart-line]").count()) === 4,
  String(await p.locator("[data-cart-line]").count()));

// -------------------------------------------------------- the pictures
const thumbs = await p.locator("[data-cart-thumb]").evaluateAll((els) =>
  els.map((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, kind: el.dataset.cartThumb }; }));
check("every line has a small square picture",
  thumbs.length === 4 && thumbs.every((t) => t.w === t.h && t.w >= 56 && t.w <= 80), JSON.stringify(thumbs));
check("the guide shows the drop's featured piece, from its photo",
  (await guide.locator("[data-cart-thumb]").getAttribute("data-cart-thumb")) === "photo" &&
    (await guide.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0)));
check("a photo that fails to load becomes the placeholder, not a broken image",
  (await tee.locator("[data-cart-thumb]").getAttribute("data-cart-thumb")) === "placeholder" &&
    (await tee.locator("img").count()) === 0);
check("a line with no photo shows the placeholder",
  (await optic.locator("[data-cart-thumb]").getAttribute("data-cart-thumb")) === "placeholder" &&
    (await bag.locator("[data-cart-thumb]").getAttribute("data-cart-thumb")) === "placeholder");
const broken = await p.locator("main img").evaluateAll((imgs) => imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length);
check("no broken image anywhere in the cart", broken === 0, `${broken} broken`);
check("the placeholder is the shop's mark, never an empty box",
  (await optic.locator("[data-cart-thumb]").innerText()).trim() === "MLF");

// ---------------------------------------------------------- the words
const guideText = (await guide.innerText()).replace(/\s+/g, " ");
check("the guide line names the piece, the drop, the quantity and the price",
  /Guide to the SIG MPX Carbon/.test(guideText) && /September Rifle Game/.test(guideText) &&
    (await guide.locator("[data-cart-qty]").innerText()) === "2" &&
    (await guide.locator("[data-cart-line-total]").innerText()) === "$60.00", guideText);
check("apparel shows its size", (await tee.locator("[data-cart-size]").innerText()).toLowerCase() === "size small");
check("a single unit to collect shows Qty 1 and no stepper",
  (await bag.locator("[data-cart-qty-fixed]").count()) === 1 && (await bag.locator("[data-cart-plus]").count()) === 0);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("nothing runs off the side of a phone, even a long name", overflow <= 0, `${overflow}px wider`);
const priceBox = await bag.locator("[data-cart-line-total]").boundingBox();
check("and the price stays on screen beside it", priceBox && priceBox.x + priceBox.width <= 390, JSON.stringify(priceBox));
await p.screenshot({ path: join(SHOTS, "phone.png"), fullPage: true });

// ------------------------------------------ quantity, straight away
const subtotal = () => p.locator('[data-cart-row="subtotal"]').innerText();
const before = await subtotal();
await guide.locator("[data-cart-plus]").click();
// Read in the same tick as the tap: no waiting for the server.
const immediate = await p.evaluate(() => ({
  qty: document.querySelector('[data-cart-line^="game:"] [data-cart-qty]')?.textContent,
  line: document.querySelector('[data-cart-line^="game:"] [data-cart-line-total]')?.textContent,
  sub: document.querySelector('[data-cart-row="subtotal"]')?.textContent,
}));
check("+ changes the quantity, the line price and the subtotal at once",
  immediate.qty === "3" && immediate.line === "$90.00" && immediate.sub !== before, JSON.stringify(immediate));
await p.waitForSelector('[data-cart-totals="settled"]');
const settled = await p.locator("[data-cart-total]").innerText();
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(600);
check("and the total the server settles on is what a fresh load shows",
  (await p.locator("[data-cart-total]").innerText()) === settled &&
    (await line(`game:${GAME}`).locator("[data-cart-qty]").innerText()) === "3", settled);

// Fast taps: the last one wins, not the last reply to arrive.
for (let i = 0; i < 2; i += 1) await line(`game:${GAME}`).locator("[data-cart-plus]").click();
await p.waitForSelector('[data-cart-totals="settled"]');
check("the guide stops at the guides left in the drop (5)",
  (await line(`game:${GAME}`).locator("[data-cart-qty]").innerText()) === "5" &&
    (await line(`game:${GAME}`).locator("[data-cart-plus]").isDisabled()));
await p.waitForTimeout(400);
check("after rapid taps the line and the total agree: 5 guides, $150.00",
  (await line(`game:${GAME}`).locator("[data-cart-line-total]").innerText()) === "$150.00");
check("− cannot go below one", await line(`${SHIRT}:${V_S}`).locator("[data-cart-minus]").isDisabled());

// ----------------------------------------------------------- remove
const totalBefore = await p.locator("[data-cart-total]").innerText();
await line(`${OPTIC}:`).locator("[data-cart-remove]").click();
check("Remove takes the line off at once", (await line(`${OPTIC}:`).count()) === 0);
await p.waitForSelector('[data-cart-totals="settled"]');
check("and the total comes down", (await p.locator("[data-cart-total]").innerText()) !== totalBefore,
  `${totalBefore} then ${await p.locator("[data-cart-total]").innerText()}`);

// --------------------------------------------- the payment page is left alone
await p.goto(`${APP}/checkout`, { waitUntil: "networkidle" });
check("the payment page shows no line pictures",
  (await p.locator("main [data-cart-thumb], main img").count()) === 0,
  `${await p.locator("main img").count()} images`);

await b.close();
report();
