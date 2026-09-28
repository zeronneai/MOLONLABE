// Everyone sets their own password: the admin's half.
//
// A flagged account (every new one, and the owner and manager when the
// migration runs) signs in with the temporary password it was given and
// can do nothing but choose its own. This walks that as the manager: the
// refusals in words, the change, the admin opening, the old password no
// longer working, other sessions signed out, and the activity log saying
// it happened without ever holding the password. Then the owner changes
// theirs from the header, as anyone can at any time.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, ARTIFACTS, MANAGER, OWNER } from "../lib/config.mjs";
import { adminPage, browser, dump, page as newPage, reset, suite, update } from "../lib/harness.mjs";

const { check, report } = suite();
const SHOTS = join(ARTIFACTS, "passwords");
mkdirSync(SHOTS, { recursive: true });
const GAME = "55555555-5555-4555-8555-555555555555";
const NEW = "harbor lantern quietly 42";

await reset();
await update("staff", `user_id=eq.${MANAGER.id}`, { must_change_password: true });
const b = await browser();

async function signIn(email, password, viewport = { width: 390, height: 844 }) {
  const p = await newPage(b, { viewport });
  await p.goto(`${APP}/admin`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', password);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(2000);
  return p;
}
const form = (p) => p.locator("[data-password-form]");
async function attempt(p, { current, next, confirm = next }) {
  await form(p).locator('[name="current"]').fill(current);
  await form(p).locator('[name="next"]').fill(next);
  await form(p).locator('[name="confirm"]').fill(confirm);
  await form(p).locator('[name="next"]').evaluate((el) => el.removeAttribute("minlength"));
  await form(p).getByRole("button", { name: /set my password|change password/i }).click();
  await p.waitForTimeout(1500);
}
const errorOn = (p, field) => p.locator(`[data-password-error="${field}"]`).innerText().catch(() => "");

// ------------------------------------------------ held at the first sign-in
const m = await signIn(MANAGER.email, "x");
check("MANAGER signing in with the temporary password is asked to choose their own",
  (await m.locator("[data-forced-password]").count()) === 1, (await m.locator("body").innerText()).slice(0, 80));
check("and sees nothing of the admin: no tabs, no data",
  (await m.getByRole("navigation", { name: "Admin" }).count()) === 0);
await m.screenshot({ path: join(SHOTS, "forced-phone.png"), fullPage: true });
await m.goto(`${APP}/admin/orders`, { waitUntil: "networkidle" });
check("asking for another admin page gets the same screen",
  (await m.locator("[data-forced-password]").count()) === 1 && !/ORDERS/.test(await m.locator("body").innerText()));
await m.goto(`${APP}/draw/${GAME}`, { waitUntil: "networkidle" });
check("the draw presentation sends them back to choose a password", (await m.locator("[data-forced-password]").count()) === 1);
const pdf = await m.request.get(`${APP}/admin/games/${GAME}/guide.pdf`);
check("the guide download refuses them", pdf.status() === 403, String(pdf.status()));

// ------------------------------------------------------------ refusals
await m.goto(`${APP}/admin`, { waitUntil: "networkidle" });
await form(m).locator('[name="next"]').fill("short");
check("as they type, it says what is wrong",
  /at least 12 characters/i.test(await m.locator("[data-password-hint]").innerText()));
await attempt(m, { current: "x", next: "short one" });
check("too short is refused, in words", /at least 12 characters \(this one has 9\)/i.test(await errorOn(m, "next")),
  await errorOn(m, "next"));
check("and what was typed is kept", (await form(m).locator('[name="current"]').inputValue()) === "x");
await attempt(m, { current: "x", next: "molonlabe forever 2026" });
check("built from the shop's name is refused", /Don't build it from "molon/.test(await errorOn(m, "next")), await errorOn(m, "next"));
await attempt(m, { current: "x", next: "1234567890123" });
check("a straight run of digits is refused", /straight run/.test(await errorOn(m, "next")), await errorOn(m, "next"));
await attempt(m, { current: "x", next: NEW, confirm: `${NEW}!` });
check("the two new ones must match", /don't match/i.test(await errorOn(m, "confirm")), await errorOn(m, "confirm"));
await attempt(m, { current: "not it", next: NEW });
check("a wrong temporary password is refused", /isn't your current password/i.test(await errorOn(m, "current")),
  await errorOn(m, "current"));
check("and after all that, still nothing changed at Supabase",
  !(await dump()).auth_events.some((e) => e.kind === "password_updated"));

// --------------------------------------------------------------- the change
await attempt(m, { current: "x", next: NEW });
await m.waitForTimeout(1500);
let d = await dump();
check("the new password is set through Supabase", d.auth_events.some((e) => e.kind === "password_updated" && e.user_id === MANAGER.id));
check("everywhere else this account was signed in is signed out",
  d.auth_events.some((e) => e.kind === "logout" && e.scope === "others" && e.user_id === MANAGER.id));
check("the flag is cleared", d.staff.find((s) => s.user_id === MANAGER.id)?.must_change_password === false);
check("and the admin opens straight away",
  (await m.locator("[data-forced-password]").count()) === 0 &&
    (await m.getByRole("navigation", { name: "Admin" }).count()) === 1);

// ------------------------------------------------ the old password is gone
const old = await signIn(MANAGER.email, "x");
check("the temporary password no longer signs in",
  (await old.locator('input[type="password"]').count()) === 1 && (await old.getByRole("navigation", { name: "Admin" }).count()) === 0);
const fresh = await signIn(MANAGER.email, NEW);
check("the new one does, straight into the admin",
  (await fresh.getByRole("navigation", { name: "Admin" }).count()) === 1 && (await fresh.locator("[data-forced-password]").count()) === 0);

// -------------------------------------------------- the owner, from the header
const o = await adminPage(b, { viewport: { width: 1280, height: 1000 } });
await o.locator("[data-change-password]").click();
await o.waitForURL(/\/admin\/password$/);
await attempt(o, { current: "x", next: "copper mesa sunrise 9" });
check("OWNER changes their password from the header's Password link",
  /Your password is changed/.test(await o.locator("[data-password-done]").innerText().catch(() => "")));
check("and stays in the admin", (await o.getByRole("navigation", { name: "Admin" }).count()) === 1);

// ------------------------------------------------------------ the log
await o.goto(`${APP}/admin/activity`, { waitUntil: "networkidle" });
const log = (await o.locator("main").innerText()).replace(/\s+/g, " ");
check("the activity log shows the manager set their own password",
  /Luis Ortega.{0,40}set their own password for the first time/i.test(log), (log.match(/.{0,40}password.{0,40}/i) ?? ["NOT LOGGED"])[0]);
check("and the owner changed theirs", /Rey Marquez.{0,40}changed their password/i.test(log));
d = await dump();
const everything = JSON.stringify(d.admin_activity) + JSON.stringify(d.auth_events) + log;
check("no password appears anywhere in the log or the records",
  !everything.includes(NEW) && !everything.includes("copper mesa"));

await b.close();
report();
