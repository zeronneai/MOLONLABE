// Owner and manager, enforced by the database.
//
// Hiding a button is not a permission. A manager holds a real session
// token and can call PostgREST directly with it, so the only test that
// means anything is one that acts AS the manager against the real
// policies and tries each forbidden thing. That is what this does.
//
// HOW IT ACTS AS SOMEBODY
//
// Exactly as PostgREST does: `set role authenticated`, then put the
// user's id in `request.jwt.claims`. The platform stub's auth.uid() reads
// that claim the way Supabase's does, so every policy sees that user.
//
// ONE THING ABOUT READING THE RESULTS
//
// Row level security refuses an INSERT with an error, but refuses an
// UPDATE or DELETE by matching no rows — the statement succeeds and
// changes nothing. So "no error" proves nothing for those. Every refusal
// below is checked by what was actually left in the table afterwards,
// read back as the superuser.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";

const { check, note, report } = suite();
const ROOT = join(import.meta.dirname, "..", "..");
const run = promisify(execFile);

const OWNER = "00000000-0000-4000-8000-00000000000a";
const MANAGER = "00000000-0000-4000-8000-00000000000b";
const STRANGER = "00000000-0000-4000-8000-00000000000c";

const ITEM = "10000000-0000-4000-8000-000000000001";
const GAME = "20000000-0000-4000-8000-000000000001";
const ORDER = "30000000-0000-4000-8000-000000000001";
const INQUIRY = "40000000-0000-4000-8000-000000000001";

const scratch = await scratchDatabase("roles");
const sql = scratch.sql;

/**
 * Runs `text` as `user` over the authenticated role, in one transaction.
 *
 * Quiet, so psql prints the query's rows and not its command tags; the
 * claim is set with SET LOCAL for the same reason. What comes back is
 * the rows of whichever statement returned any.
 */
const as = (user, text) =>
  new Promise((resolve) => {
    const p = spawn("psql", [
      "-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", scratch.name,
      "-q", "-t", "-A", "-c",
      `set local role authenticated;
       set local request.jwt.claims = '{"sub":"${user}","role":"authenticated"}';
       ${text}`,
    ]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });

/** The last line of a result, which is the query's answer. */
const answer = (r) => r.out.split("\n").filter(Boolean).pop() ?? "";

/**
 * Was this refused BY THE POLICY, and not by something else first?
 *
 * An UPDATE or DELETE that RLS filters succeeds and changes nothing; an
 * INSERT that RLS refuses errors naming row-level security. Any OTHER
 * error means the statement died before the policy was consulted, and
 * the table being unchanged proves nothing about the policy. That exact
 * thing happened while this suite was written: a missing schema grant
 * made half the refusals "pass".
 */
const byPolicy = (r) => r.code === 0 || /row-level security/i.test(r.err);
const why = (r) => (r.code === 0 ? "matched no rows" : r.err.split("\n")[0]);

const one = async (text) => (await sql(text)).split("\n").pop();

try {
  // Supabase grants ALL on public tables to anon, authenticated and
  // service_role and uses RLS as the only gate. The template is built from
  // the migrations alone, so the same grants are applied here; without
  // them every refusal below would be "permission denied for table" and
  // would prove the grants, not the policies.
  await sql(`
    grant usage on schema public, storage to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all tables in schema storage to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
  `);

  await sql(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.com'),
      ('${MANAGER}', 'manager@example.com'),
      ('${STRANGER}', 'stranger@example.com');
    insert into public.staff (user_id, role, display_name) values
      ('${OWNER}', 'owner', 'Rey Marquez'),
      ('${MANAGER}', 'manager', 'Luis Ortega');

    insert into public.items (id, slug, name, category, price_cents, fulfillment_type, status)
      values ('${ITEM}', 'test-tee', 'Test Tee', 'apparel', 3200, 'ship', 'available');
    insert into public.games (id, title, total_spots, spot_price_cents, status)
      values ('${GAME}', 'Test Game', 3, 1000, 'full');
    insert into public.game_spots (game_id, spot_number, status, first_name, last_name, email, phone)
      select '${GAME}', n, 'sold', 'Ana', 'Lopez', 'ana@example.com', '9155550100'
      from generate_series(1, 3) n;
    insert into public.inquiries (id, type, name, email, status)
      values ('${INQUIRY}', 'transfer', 'Tom', 'tom@example.com', 'new');
    insert into public.settings (key, value) values
      ('commerce', '{"tax_rate_bps":825,"shipping_standard_cents":1000,"shipping_oversize_cents":2000}'),
      ('game_offer', '{"enabled":false,"code":"","value":""}')
      on conflict (key) do nothing;
    insert into public.admin_activity (actor_name, action, entity, entity_label)
      values ('Rey Marquez', 'update', 'item', 'seed line');
    insert into storage.objects (bucket_id, name) values ('product-images', 'items/photo.webp');
  `);

  // An order needs its required columns; insert what the table demands.
  await sql(`
    insert into public.orders (
      id, order_number, status, email, first_name, last_name,
      subtotal_cents, tax_cents, shipping_cents, total_cents,
      has_shipment, has_pickup, disclaimer_accepted_at, disclaimer_text, refund_policy_text, confirmation_token
    ) values (
      '${ORDER}', 'MLF-ROLES1', 'paid', 'buyer@example.com', 'Buyer', 'One',
      3000, 248, 0, 3248, false, true, now(), 'disclaimer', 'refunds', 'tok'
    );
  `);

  // ==================================================================
  // THE MANAGER IS REFUSED
  // ==================================================================
  // Each: what he tries, and a query whose answer must be unchanged
  // afterwards. Both halves are checked — the table untouched, AND the
  // statement stopped by the policy rather than by anything else.
  const refusals = [
    ["delete an item", `delete from public.items where id = '${ITEM}'`,
      `select count(*) from public.items where id = '${ITEM}'`, "1"],
    ["delete a game", `delete from public.games where id = '${GAME}'`,
      `select count(*) from public.games where id = '${GAME}'`, "1"],
    ["delete an inquiry", `delete from public.inquiries where id = '${INQUIRY}'`,
      `select count(*) from public.inquiries where id = '${INQUIRY}'`, "1"],
    ["delete an order", `delete from public.orders where id = '${ORDER}'`,
      `select count(*) from public.orders where id = '${ORDER}'`, "1"],
    ["change an order", `update public.orders set total_cents = 1 where id = '${ORDER}'`,
      `select total_cents from public.orders where id = '${ORDER}'`, "3248"],
    ["delete spots", `delete from public.game_spots where game_id = '${GAME}'`,
      `select count(*) from public.game_spots where game_id = '${GAME}'`, "3"],
    ["write spots directly",
      `insert into public.game_spots (game_id, spot_number) values ('${GAME}', 99)`,
      `select count(*) from public.game_spots where spot_number = 99`, "0"],
    ["change the tax rate",
      `update public.settings set value = jsonb_set(value, '{tax_rate_bps}', '0') where key = 'commerce'`,
      `select value->>'tax_rate_bps' from public.settings where key = 'commerce'`, "825"],
    ["change shipping prices",
      `update public.settings set value = jsonb_set(value, '{shipping_standard_cents}', '1') where key = 'commerce'`,
      `select value->>'shipping_standard_cents' from public.settings where key = 'commerce'`, "1000"],
    ["switch the offer on or change the code",
      `update public.settings set value = '{"enabled":true,"code":"FREE","value":"x"}' where key = 'game_offer'`,
      `select (value->>'enabled') || (value->>'code') from public.settings where key = 'game_offer'`, "false"],
    ["delete a setting", `delete from public.settings where key = 'commerce'`,
      `select count(*) from public.settings where key = 'commerce'`, "1"],
    ["create a setting (alert recipients)",
      `insert into public.settings (key, value) values ('alert_routing', '{"urgent":["x@example.com"]}')`,
      `select count(*) from public.settings where key = 'alert_routing'`, "0"],
    ["give another account access",
      `insert into public.staff (user_id, role, display_name) values ('${STRANGER}', 'owner', 'Mallory')`,
      `select count(*) from public.staff where user_id = '${STRANGER}'`, "0"],
    ["promote himself", `update public.staff set role = 'owner' where user_id = '${MANAGER}'`,
      `select role from public.staff where user_id = '${MANAGER}'`, "manager"],
    ["remove an account", `delete from public.staff where user_id = '${OWNER}'`,
      `select count(*) from public.staff where user_id = '${OWNER}'`, "1"],
    ["delete a product photo file", `delete from storage.objects where name = 'items/photo.webp'`,
      `select count(*) from storage.objects where name = 'items/photo.webp'`, "1"],
    ["rewrite a log line", `update public.admin_activity set entity_label = 'gone'`,
      `select count(*) from public.admin_activity where entity_label = 'seed line'`, "1"],
  ];
  for (const [what, attempt, probe, want] of refusals) {
    const r = await as(MANAGER, `${attempt};`);
    const left = await one(probe);
    check(`MANAGER cannot ${what}`, left === want && byPolicy(r),
      left !== want ? `changed: ${left}` : why(r));
  }

  const logRead = await as(MANAGER, `select count(*) from public.admin_activity;`);
  check("MANAGER cannot read the activity log", logRead.code === 0 && answer(logRead) === "0",
    logRead.code === 0 ? `${answer(logRead)} rows visible` : why(logRead));

  // ==================================================================
  // THE MANAGER CAN DO HIS JOB
  // ==================================================================
  const add = await as(MANAGER, `
    insert into public.items (slug, name, category, price_cents, fulfillment_type, status)
    values ('mgr-cap', 'Manager Cap', 'apparel', 2500, 'ship', 'available')
    returning updated_by_name;`);
  check("MANAGER can add an item", add.code === 0, answer(add) || add.err.split("\n")[0]);
  check("and it is stamped with his name from the staff table", answer(add) === "Luis Ortega",
    answer(add));

  const price = await as(MANAGER, `
    update public.items set price_cents = 2800, updated_by_name = 'Rey Marquez'
    where id = '${ITEM}' returning price_cents || ' ' || updated_by_name;`);
  check("MANAGER can change a price", answer(price).startsWith("2800"), answer(price));
  check("and cannot sign the edit as the owner",
    answer(price).endsWith("Luis Ortega"), answer(price));

  const archive = await as(MANAGER,
    `update public.items set status = 'archived' where id = '${ITEM}' returning status;`);
  check("MANAGER can archive an item", answer(archive) === "archived", answer(archive));
  await sql(`update public.items set status = 'available' where id = '${ITEM}'`);

  const sizes = await as(MANAGER, `
    insert into public.item_variants (item_id, size, stock) values ('${ITEM}', 'M', 4);
    update public.item_variants set stock = 2 where item_id = '${ITEM}' and size = 'M';
    select stock from public.item_variants where item_id = '${ITEM}' and size = 'M';`);
  check("MANAGER can set sizes and stock", answer(sizes) === "2", answer(sizes) || sizes.err);

  const created = await as(MANAGER, `
    select public.create_game('Manager Game', null, null, null,
      'why why why why why why why why why why why', 'care care care care care care care care',
      'pairs pairs pairs pairs pairs pairs pairs pairs', 25, 3000);`);
  const newGame = answer(created);
  check("MANAGER can create a game", created.code === 0 && /^[0-9a-f-]{36}$/.test(newGame),
    newGame || created.err.split("\n")[0]);
  check("with every spot laid out in the same transaction",
    (await one(`select count(*) from public.game_spots where game_id = '${newGame}'`)) === "25");
  check("and stamped with his name",
    (await one(`select created_by_name from public.games where id = '${newGame}'`)) === "Luis Ortega");

  const draw = await as(MANAGER, `
    insert into public.winners (game_id, spot_id, display_name, seed, ticket, ticket_index, entry_total)
      select '${GAME}', id, 'Ana L.', 'seed', spot_number, 0, 3
      from public.game_spots where game_id = '${GAME}' and spot_number = 2;
    update public.games set status = 'drawn' where id = '${GAME}' returning status;`);
  check("MANAGER can run the draw", answer(draw) === "drawn", answer(draw) || draw.err.split("\n")[0]);

  const winner = await as(MANAGER, `
    select s.first_name || ' ' || s.email || ' ' || s.phone
    from public.winners w join public.game_spots s on s.id = w.spot_id
    where w.game_id = '${GAME}';`);
  check("MANAGER can see the winner's contact details",
    answer(winner) === "Ana ana@example.com 9155550100", answer(winner));

  const orders = await as(MANAGER, `select count(*) from public.orders;`);
  check("MANAGER can see orders", answer(orders) === "1", answer(orders));

  const inquiry = await as(MANAGER,
    `update public.inquiries set status = 'handled' where id = '${INQUIRY}' returning status;`);
  check("MANAGER can see and mark a transfer request handled", answer(inquiry) === "handled",
    answer(inquiry));

  const upload = await as(MANAGER,
    `insert into storage.objects (bucket_id, name) values ('product-images', 'items/mgr.webp') returning name;`);
  check("MANAGER can upload a product photo", answer(upload) === "items/mgr.webp",
    answer(upload) || upload.err.split("\n")[0]);

  // ==================================================================
  // THE LOG CANNOT BE SIGNED BY ANYONE ELSE
  // ==================================================================
  await as(MANAGER, `
    insert into public.admin_activity (actor_id, actor_name, action, entity, entity_label)
    values ('${OWNER}', 'Rey Marquez', 'delete', 'item', 'forged');`);
  const forged = await one(
    `select actor_id || ' ' || actor_name from public.admin_activity where entity_label = 'forged'`);
  check("a manager's log line carries HIS id and name, whatever he sends",
    forged === `${MANAGER} Luis Ortega`, forged);

  await as(OWNER, `update public.admin_activity set actor_name = 'nobody';`);
  await as(OWNER, `delete from public.admin_activity;`);
  check("not even the owner can edit or remove a log line",
    (await one(`select count(*) from public.admin_activity where actor_name = 'nobody'`)) === "0" &&
      Number(await one(`select count(*) from public.admin_activity`)) >= 2);

  // ==================================================================
  // THE OWNER, EXACTLY AS BEFORE
  // ==================================================================
  const ownerLog = await as(OWNER, `select count(*) from public.admin_activity;`);
  check("OWNER reads the whole log", Number(answer(ownerLog)) >= 2, answer(ownerLog));

  const ownerTax = await as(OWNER, `
    update public.settings set value = jsonb_set(value, '{tax_rate_bps}', '800')
    where key = 'commerce' returning value->>'tax_rate_bps';`);
  check("OWNER can change the tax rate", answer(ownerTax) === "800", answer(ownerTax));

  const ownerRouting = await as(OWNER, `
    insert into public.settings (key, value) values ('alert_routing', '{"urgent":[]}') returning key;`);
  check("OWNER can create the alert routing setting", answer(ownerRouting) === "alert_routing",
    answer(ownerRouting) || ownerRouting.err.split("\n")[0]);

  await as(OWNER, `delete from storage.objects where name = 'items/photo.webp';`);
  check("OWNER can delete a photo file",
    (await one(`select count(*) from storage.objects where name = 'items/photo.webp'`)) === "0");

  await as(OWNER, `delete from public.items where slug = 'mgr-cap';`);
  check("OWNER can delete an item",
    (await one(`select count(*) from public.items where slug = 'mgr-cap'`)) === "0");

  const team = await as(OWNER, `select count(*) from public.staff;`);
  check("OWNER sees the whole team", answer(team) === "2", answer(team));
  const self = await as(MANAGER, `select count(*) from public.staff;`);
  check("MANAGER sees only himself", answer(self) === "1", answer(self));

  // ==================================================================
  // AN ACCOUNT WITH NO ROLE GETS NOTHING
  // ==================================================================
  // This is the hole the roles close: before this migration, any account
  // that could sign in was a full admin — including one created through
  // an open signup form with the public key.
  const strangerItems = await as(STRANGER, `select count(*) from public.items;`);
  check("a signed-in account with no role reads no items", answer(strangerItems) === "0",
    answer(strangerItems));
  const strangerOrders = await as(STRANGER, `select count(*) from public.orders;`);
  check("and no orders", answer(strangerOrders) === "0", answer(strangerOrders));
  const strangerAdd = await as(STRANGER, `
    insert into public.items (slug, name, category, status) values ('x', 'x', 'apparel', 'available');`);
  check("and cannot add anything", strangerAdd.code !== 0, strangerAdd.err.split("\n")[0]);
  const strangerGame = await as(STRANGER,
    `select public.create_game('x', null, null, null, 'a', 'b', 'c', 5, 1000);`);
  check("and cannot create a game through the function either",
    strangerGame.code !== 0 && /staff/i.test(strangerGame.err), strangerGame.err.split("\n")[0]);

  // ==================================================================
  // CHECKOUT STILL WORKS
  // ==================================================================
  // The authorship trigger calls staff_name(), and a function called
  // inside a trigger is checked against the role doing the write.
  // Checkout marks items sold with the service role, so without the grant
  // every single-unit sale would fail after the card had been charged.
  const sold = await scratch.trySql(`
    set role service_role;
    update public.items set status = 'sold' where id = '${ITEM}' returning status;`);
  check("the service role can still mark an item sold",
    sold.code === 0 && sold.out.split("\n").includes("sold"),
    sold.out || sold.err.split("\n")[0]);

  const anonRouting = await scratch.trySql(`
    insert into public.settings (key, value) values ('alert_routing', '{"problems":["a@example.com"]}')
      on conflict (key) do nothing;
    set role anon;
    select count(*) from public.settings where key = 'alert_routing';`);
  check("the public key cannot read who gets alerts",
    anonRouting.code === 0 && anonRouting.out.split("\n").pop() === "0", anonRouting.out || anonRouting.err);
  const strangerSettings = await as(STRANGER, `select count(*) from public.settings;`);
  check("nor can a signed-in account with no role read any setting",
    answer(strangerSettings) === "0", answer(strangerSettings));

  const anonRole = await scratch.trySql(`set role anon; select public.staff_role();`);
  check("anon cannot call the role functions", anonRole.code !== 0,
    anonRole.err.split("\n")[0]);
} finally {
  await scratch.drop();
}

// ====================================================================
// EVERYONE WHO EXISTS WHEN THE MIGRATION RUNS BECOMES AN OWNER
// ====================================================================
// The one assertion that protects deploy day. If the backfill does not
// run, applying the migration locks every existing account out of the
// admin, including the only people who could fix it.
{
  const db = `mlf_backfill_${randomBytes(4).toString("hex")}`;
  const base = ["-h", PG.host, "-p", PG.port, "-U", PG.user];
  const psql = (args) => run("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", ...args],
    { maxBuffer: 64 << 20 });
  try {
    await psql(["-d", "postgres", "-c", `create database ${db}`]);
    await psql(["-d", db, "-f", join(ROOT, "tests/fixtures/platform-stub.sql")]);
    const migrations = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql")).sort();
    const rolesAt = migrations.findIndex((f) => f.includes("staff_roles"));
    for (const f of migrations.slice(0, rolesAt)) {
      await psql(["-d", db, "-f", join(ROOT, "supabase/migrations", f)]);
    }
    await psql(["-d", db, "-c", `
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${OWNER}', 'o@example.com', '{"full_name":"Rey Marquez"}'),
        ('${MANAGER}', 'a@example.com', null);`]);
    for (const f of migrations.slice(rolesAt)) {
      await psql(["-d", db, "-f", join(ROOT, "supabase/migrations", f)]);
    }
    const { stdout } = await run("psql", [...base, "-d", db, "-t", "-A", "-c",
      "select role || '|' || display_name from public.staff order by display_name"]);
    const rows = stdout.trim().split("\n");
    check("every account that existed becomes an owner",
      rows.length === 2 && rows.every((r) => r.startsWith("owner|")), rows.join(", "));
    check("keeping the name it already had",
      rows.includes("owner|Rey Marquez"), rows.join(", "));
    check("and an obviously unfinished name where it had none",
      rows.includes("owner|Owner (set a name)"), rows.join(", "));
    note("create the manager AFTER applying the migration, or he is backfilled as an owner");
  } finally {
    await run("psql", [...base, "-d", "postgres", "-c",
      `drop database if exists ${db}`]).catch(() => {});
  }
}

report();
