// Removing a photo deletes the file only once the item is saved without it.
//
// It used to delete the file the moment ✕ was pressed. Abandon the form
// after that, and the item still listed a photograph that no longer
// existed: a broken image on the public page, found by a customer. The
// manager runs the site alone for a month, so this is checked the way it
// would go wrong for him as well as for the owner.
//
// Also: duplicating an item copies its photo addresses, so an original
// and its copy share files. Removing a photo from one must not delete a
// file the other still shows.

import { APP, DOUBLE } from "../lib/config.mjs";
import { adminPage, browser, dump, insert, managerPage, reset, storage, suite } from "../lib/harness.mjs";

const { check, report } = suite();

const ORIGINAL = "99999999-0000-4000-8000-000000000001";
const COPY = "99999999-0000-4000-8000-000000000002";
const url = (name) => `${DOUBLE}/storage/v1/object/public/product-images/items/${name}.webp`;
const has = async (name) =>
  (await storage()).some((o) => o.key === `product-images/items/${name}.webp`);
const imagesOf = async (id) => (await dump()).items.find((i) => i.id === id)?.images ?? null;

await reset();
for (const name of ["only", "shared"]) {
  await fetch(`${DOUBLE}/storage/v1/object/product-images/items/${name}.webp`, {
    method: "POST", headers: { "content-type": "image/webp" }, body: "webp",
  });
}
const base = {
  category: "accessory", brand: null, short_desc: null, long_desc: null, specs: {},
  price_display: null, price_cents: 2500, fulfillment_type: "ship", shipping_tier: "standard",
  has_variants: false, status: "available", is_featured: false, sort_order: 9, video_url: null,
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
};
await insert("items", { ...base, id: ORIGINAL, slug: "photo-original", name: "Photo Original",
  images: [url("only"), url("shared")] });
await insert("items", { ...base, id: COPY, slug: "photo-copy", name: "Photo Copy",
  images: [url("shared")] });

const b = await browser();

// ------------------------------------------ remove, then walk away
const owner = await adminPage(b, { viewport: { width: 1280, height: 1200 } });
await owner.goto(`${APP}/admin/inventory/${ORIGINAL}`, { waitUntil: "networkidle" });
await owner.getByRole("button", { name: "Remove image" }).first().click();
await owner.waitForTimeout(800);
await owner.goto(`${APP}/admin/inventory`, { waitUntil: "networkidle" });
check("OWNER removes a photo and abandons the form: the file is still there",
  await has("only"));
check("and the item still lists both photos, both of which exist",
  JSON.stringify(await imagesOf(ORIGINAL)) === JSON.stringify([url("only"), url("shared")]) &&
    (await has("only")) && (await has("shared")),
  JSON.stringify(await imagesOf(ORIGINAL)));

// ------------------------------------------ remove both, then save
await owner.goto(`${APP}/admin/inventory/${ORIGINAL}`, { waitUntil: "networkidle" });
await owner.getByRole("button", { name: "Remove image" }).first().click();
await owner.getByRole("button", { name: "Remove image" }).first().click();
await owner.getByRole("button", { name: /save changes/i }).click();
await owner.waitForURL(/\/admin\/inventory$/, { timeout: 15000 }).catch(() => {});
await owner.waitForTimeout(500);
check("OWNER saves without them: the item lists no photos",
  JSON.stringify(await imagesOf(ORIGINAL)) === "[]", JSON.stringify(await imagesOf(ORIGINAL)));
check("the photo only it used is deleted, after the save", !(await has("only")));
check("the photo its copy still shows is kept", await has("shared"));

// ------------------------------------------ the manager
const manager = await managerPage(b, { viewport: { width: 1280, height: 1200 } });
await manager.goto(`${APP}/admin/inventory/${COPY}`, { waitUntil: "networkidle" });
await manager.getByRole("button", { name: "Remove image" }).first().click();
await manager.getByRole("button", { name: /save changes/i }).click();
await manager.waitForURL(/\/admin\/inventory$/, { timeout: 15000 }).catch(() => {});
await manager.waitForTimeout(500);
check("MANAGER saves without the photo: the item no longer lists it",
  JSON.stringify(await imagesOf(COPY)) === "[]", JSON.stringify(await imagesOf(COPY)));
check("and the file is left in the bucket, since deleting files is the owner's",
  await has("shared"));

// ------------------------------------------ deleting an item
await insert("items", { ...base, id: "99999999-0000-4000-8000-000000000003", slug: "photo-third",
  name: "Photo Third", images: [url("shared")] });
await owner.goto(`${APP}/admin/inventory/99999999-0000-4000-8000-000000000003`, { waitUntil: "networkidle" });
await owner.getByRole("button", { name: /delete this item/i }).click();
await owner.locator('[role="dialog"]').getByRole("button", { name: /^delete$/i }).click();
await owner.waitForURL(/deleted=1/, { timeout: 15000 }).catch(() => {});
check("OWNER deletes an item: the row is gone",
  !(await dump()).items.some((i) => i.slug === "photo-third"));
check("and then its photo, which nothing else uses", !(await has("shared")));

await b.close();
report();
