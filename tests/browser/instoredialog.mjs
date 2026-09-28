// "Record in-store sale" from the drops list, in a popup.
//
// Somebody is at the counter with a customer waiting, usually on a phone.
// So this checks the things that cost them time or a customer's patience:
// one tap to open, the count visible before typing, the first field ready,
// a refusal that keeps what was typed, numbers big enough to copy, the row
// behind updated without a reload, and a close that records nothing.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, ARTIFACTS } from "../lib/config.mjs";
import { adminPage, browser, dump, managerPage, reset, suite } from "../lib/harness.mjs";

const { check, report } = suite();
const GAME = "55555555-5555-4555-8555-555555555555";
const SHOTS = join(ARTIFACTS, "instoredialog");
mkdirSync(SHOTS, { recursive: true });

await reset();
const b = await browser();
const p = await managerPage(b, { viewport: { width: 390, height: 844 } });
await p.goto(`${APP}/admin/games`, { waitUntil: "networkidle" });
// A marker that a reload would wipe, to prove the row updates in place.
await p.evaluate(() => { window.__noReload = true; });

const row = p.locator(`[data-drop-row="${GAME}"]`);
const dialog = p.locator("[data-in-store-dialog]");
const inStore = () => dump().then((d) => d.orders.filter((o) => o.source === "in_store"));

check("an open drop's row has Record in-store sale, and says how many are left",
  (await row.locator("[data-record-in-store]").count()) === 1 &&
    (await row.locator("[data-drop-remaining]").innerText()) === "5",
  await row.innerText().then((t) => t.replace(/\s+/g, " ")));
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("the row fits a phone screen", overflow <= 0, `${overflow}px wider`);

// ------------------------------------------------------- one tap to open
await row.locator("[data-record-in-store]").click();
await dialog.waitFor();
const box = await dialog.boundingBox();
check("on a phone it opens as a full-screen sheet",
  box && box.x === 0 && box.y === 0 && Math.round(box.width) === 390 && Math.round(box.height) === 844,
  JSON.stringify(box));
check("it shows how many guides are left before anything is typed",
  /5 guides left in this drop/.test((await p.locator("[data-in-store-dialog-left]").innerText()).replace(/\s+/g, " ")));
check("the first field is ready to type into",
  (await p.evaluate(() => document.activeElement?.getAttribute("name"))) === "first_name");
await p.screenshot({ path: join(SHOTS, "phone-open.png") });

// ------------------------------------------- too many: refused inside
const fill = async ({ first, last, phone, email = "", qty, bypassMax = false }) => {
  await dialog.locator('[name="first_name"]').fill(first);
  await dialog.locator('[name="last_name"]').fill(last);
  await dialog.locator('[name="phone"]').fill(phone);
  if (email) await dialog.locator('[name="email"]').fill(email);
  if (bypassMax) await dialog.locator('[name="quantity"]').evaluate((el) => el.removeAttribute("max"));
  await dialog.locator('[name="quantity"]').fill(String(qty));
  await dialog.locator('[name="agreed"]').check();
  await dialog.getByRole("button", { name: /record the sale/i }).click();
  await p.waitForTimeout(1500);
};
await fill({ first: "Rosa", last: "Villa", phone: "915-555-0120", qty: 6, bypassMax: true });
const refusal = await dialog.locator('[data-in-store-result="error"]').innerText().catch(() => "");
check("asking for 6 with 5 left is refused inside the popup, which stays open",
  /6 guides were requested, but only 5 are available/.test(refusal) && (await dialog.count()) === 1, refusal);
check("and everything typed is still there",
  (await dialog.locator('[name="first_name"]').inputValue()) === "Rosa" &&
    (await dialog.locator('[name="phone"]').inputValue()) === "915-555-0120" &&
    (await dialog.locator('[name="agreed"]').isChecked()));
check("and nothing was recorded", (await inStore()).length === 0);

// ------------------------------------------------------- a sale
await dialog.locator('[name="quantity"]').fill("2");
await dialog.getByRole("button", { name: /record the sale/i }).click();
await p.waitForTimeout(1800);
const numbers = dialog.locator("[data-in-store-numbers]");
check("the popup stays open and shows the guide numbers", (await numbers.innerText()) === "1, 2",
  await numbers.innerText().catch(() => "NOT SHOWN"));
const size = await numbers.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
check("in large type, to copy onto a receipt", size >= 44, `${size}px`);
await p.screenshot({ path: join(SHOTS, "phone-numbers.png") });
check("the row behind shows 3 left and 2 sold, without a reload",
  (await row.locator("[data-drop-remaining]").innerText()) === "3" &&
    (await row.locator("[data-drop-sold]").innerText()) === "2" &&
    (await p.evaluate(() => window.__noReload === true)));
check("there is no Cancel once the sale is recorded, only Close or Record another",
  (await p.locator("[data-in-store-cancel]").count()) === 0 &&
    (await dialog.locator("[data-in-store-done]").getByRole("button", { name: /record another sale/i }).count()) === 1 &&
    (await dialog.locator("[data-in-store-done]").getByRole("button", { name: /^close$/i }).count()) === 1);

// ------------------------------------------------- record another
await dialog.locator("[data-in-store-done]").getByRole("button", { name: /record another sale/i }).click();
check("Record another gives an empty form, ready to type",
  (await dialog.locator('[name="first_name"]').inputValue()) === "" &&
    (await p.evaluate(() => document.activeElement?.getAttribute("name"))) === "first_name" &&
    /3 guides left/.test(await p.locator("[data-in-store-dialog-left]").innerText()));
await fill({ first: "Beto", last: "Cruz", phone: "915-555-0121", qty: 1 });
check("the next sale gets guide 3", (await numbers.innerText()) === "3");
await dialog.locator("[data-in-store-done]").getByRole("button", { name: /^close$/i }).click();
check("Close shuts the popup, and the row says 2 left",
  (await dialog.count()) === 0 && (await row.locator("[data-drop-remaining]").innerText()) === "2");

// ------------------------------------ closing without saving records nothing
const before = (await inStore()).length;
await row.locator("[data-record-in-store]").click();
await dialog.locator('[name="first_name"]').fill("Never");
await dialog.locator('[name="last_name"]').fill("Saved");
await p.locator("[data-in-store-cancel]").click();
check("Cancel closes it and records nothing", (await dialog.count()) === 0 && (await inStore()).length === before);
await row.locator("[data-record-in-store]").click();
check("and reopening starts empty", (await dialog.locator('[name="first_name"]').inputValue()) === "");
await dialog.locator('[name="first_name"]').fill("Also");
await p.keyboard.press("Escape");
check("Escape closes it too, recording nothing", (await dialog.count()) === 0 && (await inStore()).length === before);

// ------------------------------------------ the sale that fills the drop
await row.locator("[data-record-in-store]").click();
await fill({ first: "Last", last: "Two", phone: "915-555-0122", qty: 2 });
check("the last 2 are sold (4, 5), and the popup says the drop is sold out",
  (await numbers.innerText()) === "4, 5" && /sold out/i.test(await dialog.innerText()) &&
    (await dialog.locator("[data-in-store-done]").getByRole("button", { name: /record another sale/i }).count()) === 0);
await dialog.locator("[data-in-store-done]").getByRole("button", { name: /^close$/i }).click();
check("the row now reads full, and its button is gone",
  (await row.locator("[data-drop-status]").innerText()).toLowerCase() === "full" &&
    (await row.locator("[data-record-in-store]").count()) === 0);
await p.reload({ waitUntil: "networkidle" });
check("still so after a reload: a sold-out drop has no button",
  (await row.locator("[data-record-in-store]").count()) === 0);

const d = await dump();
check("three in-store sales recorded in all, by the manager",
  d.orders.filter((o) => o.source === "in_store" && o.recorded_by_name === "Luis Ortega").length === 3);

// ------------------------------------------ desktop: a box, not a sheet
await reset();
const o = await adminPage(b, { viewport: { width: 1280, height: 900 } });
await o.goto(`${APP}/admin/games`, { waitUntil: "networkidle" });
await o.locator(`[data-drop-row="${GAME}"] [data-record-in-store]`).click();
const desk = await o.locator("[data-in-store-dialog]").boundingBox();
check("OWNER on a desktop gets a box in the middle, not a full-screen sheet",
  desk && desk.width < 700 && desk.x > 200, JSON.stringify(desk));
await o.screenshot({ path: join(SHOTS, "desktop-open.png") });
await o.locator('[data-in-store-dialog] [name="first_name"]').fill("Tapped");
await o.mouse.click(20, 20);
check("a stray click outside the box does not throw the typing away",
  (await o.locator("[data-in-store-dialog]").count()) === 1 &&
    (await o.locator('[data-in-store-dialog] [name="first_name"]').inputValue()) === "Tapped");

await b.close();
report();
