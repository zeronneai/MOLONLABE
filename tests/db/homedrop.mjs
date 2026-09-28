// Two drops open at once: the home page's drop, and the order check.
//
// supabase/migrations/20261002100000_home_drop.sql lets the owner, and
// only the owner, choose the one drop the home page features. This proves
// that against real PostgreSQL, as the owner and the manager.
//
// supabase/repair/drop-check/ is what the owner runs to see whether any
// guide sold so far was recorded against the wrong drop, or may have been
// meant for another. This runs both files exactly as written against a
// copy of the situation that prompted them: BOOM STICK open, ORTHOS opened
// later, and every site button leading to the newest.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase, trySql } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";

const { check, report } = suite();
const ROOT = join(import.meta.dirname, "..", "..");
const DIR = join(ROOT, "supabase/repair/drop-check");
const run = promisify(execFile);
const TMP = mkdtempSync(join(tmpdir(), "dropcheck-"));

const OWNER = "00000000-0000-4000-8000-00000000000a";
const MANAGER = "00000000-0000-4000-8000-00000000000b";
const BOOM = "a0000000-0000-4000-8000-0000000000b1";
const ORTHOS = "a0000000-0000-4000-8000-0000000000b2";
const DRAWN = "a0000000-0000-4000-8000-0000000000b3";
const EARLY = "d0000000-0000-4000-8000-0000000000e1"; // BOOM STICK, before ORTHOS opened
const LATER = "d0000000-0000-4000-8000-0000000000e2"; // ORTHOS, while BOOM STICK was open
const COUNTER = "d0000000-0000-4000-8000-0000000000e3"; // BOOM STICK, in store

const db = await scratchDatabase("homedrop");
const sql = db.sql;
const one = async (t) => (await sql(t)).split("\n").pop();

const as = (user, text) =>
  new Promise((resolve) => {
    const p = spawn("psql", [
      "-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", db.name, "-q", "-t", "-A", "-c",
      `set local role authenticated;
       set local request.jwt.claims = '{"sub":"${user}","role":"authenticated"}';
       ${text}`,
    ]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

/** Runs a script file as the SQL editor would: whole, stopping at an error. */
async function script(file) {
  const path = join(TMP, `${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(path, readFileSync(join(DIR, file), "utf8"));
  const { stdout } = await run("psql", [
    "-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", db.name,
    "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "|", "-f", path,
  ], { maxBuffer: 16 << 20 });
  return stdout.trim().split("\n").filter(Boolean).map((l) => l.split("|"));
}
const featured = () => one(`select coalesce(string_agg(title, ','), 'none') from public.games where featured_on_home`);

try {
  await sql(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    revoke all on public.staff_password_marks from anon, authenticated;
    insert into auth.users (id, email, encrypted_password) values
      ('${OWNER}', 'owner@example.com', 'h1'), ('${MANAGER}', 'manager@example.com', 'h2');
    insert into public.staff (user_id, role, display_name, must_change_password) values
      ('${OWNER}', 'owner', 'Rey Marquez', false), ('${MANAGER}', 'manager', 'Luis Ortega', false);

    insert into public.games (id, title, total_spots, spot_price_cents, status, created_at) values
      ('${BOOM}', 'BOOM STICK', 10, 2500, 'open', '2026-09-20 09:00:00-06'),
      ('${ORTHOS}', 'Orthos', 10, 3000, 'open', '2026-09-24 09:00:00-06'),
      ('${DRAWN}', 'Summer Drop', 2, 1000, 'drawn', '2026-08-01 09:00:00-06');
    insert into public.game_spots (game_id, spot_number, status)
      select g, n, 'open' from unnest(array['${BOOM}', '${ORTHOS}']::uuid[]) g, generate_series(1, 10) n;
    insert into public.game_spots (game_id, spot_number, status, first_name, sold_at)
      select '${DRAWN}', n, 'sold', 'Past', '2026-08-02 09:00:00-06' from generate_series(1, 2) n;
  `);

  // ------------------------------------------------------ the home page's drop
  check("every existing drop starts with nothing featured (nothing chosen for the owner)",
    (await featured()) === "none");

  const byOwner = await as(OWNER, `select public.set_home_drop('${BOOM}');`);
  check("the owner features BOOM STICK", byOwner.code === 0 && (await featured()) === "BOOM STICK", byOwner.err);
  await as(OWNER, `select public.set_home_drop('${ORTHOS}');`);
  check("choosing Orthos moves the choice: one drop at a time", (await featured()) === "Orthos");

  const byManager = await as(MANAGER, `select public.set_home_drop('${BOOM}');`);
  check("the manager cannot choose it", byManager.code !== 0 && /Only the owner/.test(byManager.err) &&
    (await featured()) === "Orthos", byManager.err.split("\n")[0]);
  const direct = await as(MANAGER, `update public.games set featured_on_home = true where id = '${BOOM}';`);
  check("nor by writing the drop directly", direct.code !== 0 && /Only the owner/.test(direct.err) &&
    (await featured()) === "Orthos", direct.err.split("\n")[0]);
  const edit = await as(MANAGER, `update public.games set description = 'Counter copy' where id = '${BOOM}' returning 1;`);
  check("while the manager can still edit a drop as before", edit.code === 0 && edit.out === "1", edit.err);

  const two = await trySql(db.name, `update public.games set featured_on_home = true where id = '${BOOM}';`);
  check("the database refuses two featured drops even from the SQL editor",
    two.code !== 0 && /games_one_on_home/.test(two.err), two.err.split("\n")[0]);

  const drawn = await as(OWNER, `select public.set_home_drop('${DRAWN}');`);
  check("a drawn drop cannot be chosen", drawn.code !== 0 && /has been drawn/.test(drawn.err), drawn.err.split("\n")[0]);
  await as(OWNER, `select public.set_home_drop(null);`);
  check("the owner can clear it", (await featured()) === "none");
  const anon = await trySql(db.name, `set local role anon; select public.set_home_drop('${BOOM}');`);
  check("the anonymous key cannot call it", anon.code !== 0 && /permission denied/i.test(anon.err), anon.err.split("\n")[0]);

  // ------------------------------------------------------ the orders so far
  const order = (id, number, game, at, source = "online") => source === "online" ? `
    insert into public.orders (id, order_number, email, first_name, last_name, phone, subtotal_cents, total_cents,
      disclaimer_accepted_at, disclaimer_text, refund_policy_text, confirmation_token, game_id,
      game_terms_accepted_at, game_terms_text, created_at)
    values ('${id}', '${number}', '${number.toLowerCase()}@example.com', 'Buyer', '${number}', '9155550100', 5000, 5000,
      now(), 'x', 'x', 't-${number}', '${game}', now(), 'terms', '${at}');` : `
    insert into public.orders (id, order_number, source, email, first_name, last_name, phone, subtotal_cents, total_cents,
      gateway, game_id, game_terms_accepted_at, game_terms_text, recorded_by_name, confirmation_token, created_at)
    values ('${id}', '${number}', 'in_store', null, 'Counter', 'Buyer', '9155550111', 2500, 2500,
      'in_store', '${game}', now(), 'agreed at the counter', 'Luis Ortega', 't-${number}', '${at}');`;
  const sell = (id, game, numbers, at) => `
    update public.game_spots set status = 'sold', order_id = '${id}', first_name = 'Buyer', sold_at = '${at}'
      where game_id = '${game}' and spot_number in (${numbers.join(",")});
    insert into public.order_items (order_id, line_type, game_id, name, quantity, unit_price_cents,
      line_total_cents, fulfillment_type, spot_numbers)
    values ('${id}', 'game_spot', '${game}', 'guides', ${numbers.length}, 2500, ${2500 * numbers.length}, 'none',
      '{${numbers.join(",")}}');`;
  await sql(
    order(EARLY, "MLF-EARLY", BOOM, "2026-09-21 10:00:00-06") + sell(EARLY, BOOM, [1, 2], "2026-09-21 10:00:00-06") +
    order(LATER, "MLF-LATER", ORTHOS, "2026-09-25 10:00:00-06") + sell(LATER, ORTHOS, [1, 2, 3], "2026-09-25 10:00:00-06") +
    order(COUNTER, "MLF-S-COUNTER", BOOM, "2026-09-21 11:00:00-06", "in_store") + sell(COUNTER, BOOM, [3], "2026-09-21 11:00:00-06"),
  );

  let rows = await script("1-integrity.sql");
  const checks = rows.filter((r) => r[2] !== "INFO");
  check("file 1: every check passes when each order, its line and its guides name one drop",
    checks.length === 5 && checks.every((r) => r[2] === "PASS"), JSON.stringify(checks.filter((r) => r[2] !== "PASS")));
  check("and it counts each drop's sales, online and in store",
    rows.some((r) => r[1] === "drop: BOOM STICK" && /1 online orders, 1 in-store sales, 3 guides sold of 10/.test(r[3])) &&
      rows.some((r) => r[1] === "drop: Orthos" && /1 online orders, 0 in-store sales, 3 guides sold of 10/.test(r[3])),
    JSON.stringify(rows.filter((r) => r[2] === "INFO")));

  rows = await script("2-orders-to-review.sql");
  const byNumber = Object.fromEntries(rows.map((r) => [r[1], r]));
  check("file 2: a BOOM STICK order placed before Orthos opened is OK",
    byNumber["MLF-EARLY"]?.[0] === "OK" && byNumber["MLF-EARLY"]?.[3] === "BOOM STICK", JSON.stringify(byNumber["MLF-EARLY"]));
  check("an Orthos order placed while BOOM STICK was also open is flagged for review, naming BOOM STICK",
    byNumber["MLF-LATER"]?.[0] === "REVIEW" && byNumber["MLF-LATER"]?.[9] === "BOOM STICK" &&
      byNumber["MLF-LATER"]?.[7] === "mlf-later@example.com" && byNumber["MLF-LATER"]?.[5] === "1, 2, 3",
    JSON.stringify(byNumber["MLF-LATER"]));
  check("REVIEW rows come first", rows[0]?.[0] === "REVIEW");
  check("an in-store sale is not listed: staff chose the drop on its own page", !byNumber["MLF-S-COUNTER"]);
  check("the times are El Paso's", byNumber["MLF-LATER"]?.[2] === "2026-09-25 10:00", byNumber["MLF-LATER"]?.[2]);

  // A drop that sold out stops counting as open from its last sale.
  await sql(`
    update public.game_spots set status = 'sold', first_name = 'X', sold_at = '2026-09-22 12:00:00-06'
      where game_id = '${BOOM}' and status = 'open';
    update public.games set status = 'full' where id = '${BOOM}';`);
  rows = await script("2-orders-to-review.sql");
  check("an Orthos order after BOOM STICK sold out is OK: nothing else was on sale",
    rows.find((r) => r[1] === "MLF-LATER")?.[0] === "OK", JSON.stringify(rows.find((r) => r[1] === "MLF-LATER")));

  // ------------------------------------------------------ a wrong record
  // What a guide recorded against the wrong drop would look like: the
  // order says Orthos, but it holds a BOOM STICK guide.
  await sql(`update public.game_spots set order_id = '${LATER}' where game_id = '${BOOM}' and spot_number = 4;`);
  rows = await script("1-integrity.sql");
  const failed = rows.filter((r) => r[2] === "FAIL");
  check("file 1 fails, naming the order, when a guide sits in a different drop from its order",
    failed.some((r) => /in that order's drop/.test(r[1]) && /MLF-LATER/.test(r[3])), JSON.stringify(failed));
  check("and when the receipt's numbers are not the guides the order holds",
    failed.some((r) => /exactly the guides it holds/.test(r[1]) && /MLF-LATER/.test(r[3])));
  check("both files only read: nothing was changed by running them",
    (await one(`select count(*) from public.orders`)) === "3" &&
      (await one(`select count(*) from public.game_spots where status = 'sold'`)) === "15");
} finally {
  await db.drop();
}

report();
