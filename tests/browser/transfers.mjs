// Transfers are switched off until the client decides the service and its
// price (TRANSFERS_ENABLED in lib/brand.ts).
//
// Off means nobody can send a request the shop cannot act on yet: no
// page, no link to it anywhere a customer looks, nothing in the sitemap,
// and the server refuses a transfer request even when one is posted by
// hand. The code stays; this suite is what says it is really off.

import { APP } from "../lib/config.mjs";
import { browser, dump, page as newPage, reset, suite } from "../lib/harness.mjs";

const { check, report } = suite();
await reset();
const b = await browser();
const p = await newPage(b, { viewport: { width: 1280, height: 1000 } });

const res = await p.goto(`${APP}/transfers`, { waitUntil: "networkidle" });
check("/transfers returns a 404", res?.status() === 404, String(res?.status()));
check("and shows no form", (await p.locator("form").count()) === 0 ||
  !(await p.locator('input[name="type"][value="transfer"]').count()));

const links = [];
for (const path of ["/", "/shop", "/games", "/in-the-case", "/services", "/visit", "/inventory/sig-mpx-carbon"]) {
  await p.goto(`${APP}${path}`, { waitUntil: "networkidle" });
  const n = await p.locator('a[href="/transfers"], a[href$="/transfers"]').count();
  if (n) links.push(`${path}: ${n}`);
}
check("no page links to /transfers (header, footer, Services or anywhere else)",
  links.length === 0, links.join("; ") || "none");

// The mobile menu, whose links only exist once it is open.
const phone = await newPage(b, { viewport: { width: 390, height: 844 } });
await phone.goto(`${APP}/`, { waitUntil: "networkidle" });
const menu = phone.getByRole("button", { name: /menu/i }).first();
if (await menu.count()) await menu.click().catch(() => {});
await phone.waitForTimeout(300);
check("the mobile menu has no Transfers link",
  (await phone.locator('a[href="/transfers"]').count()) === 0);

const sitemap = await (await p.request.get(`${APP}/sitemap.xml`)).text();
check("the sitemap does not list /transfers", !sitemap.includes("/transfers"),
  sitemap.includes("/transfers") ? "listed" : "not listed");

await p.goto(`${APP}/services`, { waitUntil: "networkidle" });
const services = await p.locator("main").innerText();
check("Services does not offer transfers", !/transfer/i.test(services),
  (services.match(/[^\n]*transfer[^\n]*/i) ?? ["none"])[0]);
check("and gives the shop's number instead", /\(915\) 497-0541/.test(services));

// A transfer request posted anyway: the item inquiry form, with its type
// changed to "transfer" before sending, as a hand-made request would be.
await p.goto(`${APP}/inventory/sig-mpx-carbon`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /inquire about this/i }).first().click();
await p.waitForTimeout(600);
await p.locator('input[name="type"]').first().evaluate((el) => { el.value = "transfer"; });
await p.getByLabel("Name", { exact: true }).fill("Tom Reyes");
await p.getByLabel("Email", { exact: true }).fill("tom@example.com");
await p.locator('form button[type="submit"]').first().click();
await p.waitForTimeout(1800);
const said = await p.locator("body").innerText();
const d = await dump();
check("a transfer request posted anyway is refused",
  !d.inquiries.some((i) => i.type === "transfer" && i.email === "tom@example.com"),
  `${d.inquiries.filter((i) => i.type === "transfer").length} transfer inquiries stored`);
check("and the person is told to call instead",
  /not taking transfer requests online yet/i.test(said) && /\(915\) 497-0541/.test(said),
  (said.match(/[^\n]*transfer requests[^\n]*/i) ?? ["NOTHING SAID"])[0]);
check("nobody was alerted about it",
  !d.notifications.some((n) => n.kind === "inquiry" && JSON.stringify(n).includes("tom@example.com")));

await b.close();
report();
