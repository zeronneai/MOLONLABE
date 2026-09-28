// Everyone sets their own password: the database's half.
//
// supabase/migrations/20261001100000_own_passwords.sql flags every
// account until its holder has chosen a password, makes a flagged
// account "not staff" for every policy, and clears the flag only once
// the stored password has really changed. This acts as the manager and
// the owner against real PostgreSQL to prove each of those, and that no
// password or hash ever lands in the activity log.

import { spawn } from "node:child_process";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase, trySql } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";

const { check, report } = suite();
const OWNER = "00000000-0000-4000-8000-00000000000a";
const MANAGER = "00000000-0000-4000-8000-00000000000b";
const LATER = "00000000-0000-4000-8000-00000000000d";

const db = await scratchDatabase("passwords");
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
const answer = (r) => r.out.split("\n").filter(Boolean).pop() ?? "";
// What Supabase does when a password is changed: a new bcrypt hash.
const supabaseStores = (user, hash) => sql(`update auth.users set encrypted_password = '${hash}' where id = '${user}'`);

try {
  await sql(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    -- The permission the migration revoked, back as Supabase has it
    -- after the blanket grant above: the marks table must stay unreadable.
    revoke all on public.staff_password_marks from anon, authenticated;
    insert into auth.users (id, email, encrypted_password) values
      ('${OWNER}', 'owner@example.com', '$2a$10$temp-owner-hash'),
      ('${MANAGER}', 'manager@example.com', '$2a$10$temp-manager-hash'),
      ('${LATER}', 'later@example.com', '$2a$10$temp-later-hash');
    -- Created as the agency creates them: no flag given.
    insert into public.staff (user_id, role, display_name) values
      ('${OWNER}', 'owner', 'Rey Marquez'), ('${MANAGER}', 'manager', 'Luis Ortega');
    insert into public.orders (order_number, email, first_name, last_name, subtotal_cents, total_cents,
      confirmation_token, disclaimer_accepted_at, disclaimer_text, refund_policy_text)
      values ('MLF-P1', 'b@example.com', 'B', 'C', 100, 100, 't', now(), 'x', 'x');
  `);

  // ------------------------------------------------------ flagged by default
  check("an account added without saying anything must change its password",
    (await one(`select string_agg(must_change_password::text, ',' order by display_name) from public.staff`)) === "true,true");
  check("and what its password was then is remembered, as a fingerprint",
    (await one(`select count(*) from public.staff_password_marks where fingerprint = md5('$2a$10$temp-manager-hash')`)) === "1");

  // ------------------------------------------------------ locked out
  const orders = await as(MANAGER, `select count(*) from public.orders;`);
  check("a flagged manager can read no orders", answer(orders) === "0", answer(orders) || orders.err);
  const write = await as(MANAGER, `insert into public.items (slug, name, category, fulfillment_type, status)
    values ('x', 'X', 'apparel', 'ship', 'available') returning id;`);
  check("and can write nothing", write.code !== 0 && /row-level security/i.test(write.err), write.err.split("\n")[0]);
  const ownerFlagged = await as(OWNER, `select count(*) from public.staff;`);
  check("a flagged owner is not the owner either: sees only their own staff row",
    answer(ownerFlagged) === "1", answer(ownerFlagged));
  const own = await as(MANAGER, `select must_change_password::text from public.staff where user_id = '${MANAGER}';`);
  check("they can still see their own row, so the admin knows to ask", answer(own) === "true", answer(own));

  // ---------------------------------------------- the flag will not just clear
  const skip = await as(MANAGER, `select public.record_password_change();`);
  check("claiming a change without one is refused", skip.code !== 0 && /has not been changed yet/.test(skip.err),
    skip.err.split("\n")[0]);
  check("and the manager is still flagged",
    (await one(`select must_change_password::text from public.staff where user_id = '${MANAGER}'`)) === "true");
  const direct = await as(MANAGER, `update public.staff set must_change_password = false where user_id = '${MANAGER}' returning 1;`);
  check("nor can they clear it by writing the row", answer(direct) === "" &&
    (await one(`select must_change_password::text from public.staff where user_id = '${MANAGER}'`)) === "true",
    direct.err.split("\n")[0] || "no rows changed");
  const peek = await as(MANAGER, `select fingerprint from public.staff_password_marks;`);
  check("and nobody signed in can read the fingerprints", peek.code !== 0 && /permission denied/i.test(peek.err),
    peek.err.split("\n")[0]);

  // ------------------------------------------------------ a real change
  await supabaseStores(MANAGER, "$2a$10$new-manager-hash");
  const done = await as(MANAGER, `select public.record_password_change();`);
  check("after Supabase stores a new password, the change is recorded as the first one",
    done.code === 0 && answer(done) === "t", answer(done) || done.err);
  check("the flag is cleared and the fingerprint forgotten",
    (await one(`select must_change_password::text || (select count(*) from public.staff_password_marks where user_id = '${MANAGER}')
      from public.staff where user_id = '${MANAGER}'`)) === "false0");
  const now = await as(MANAGER, `select count(*) from public.orders;`);
  check("and the manager can work again", answer(now) === "1", answer(now));
  check("the owner, who has not changed theirs, still cannot",
    answer(await as(OWNER, `select count(*) from public.orders;`)) === "0");

  const log = await one(`select json_build_object('actor', actor_name, 'action', action, 'entity', entity,
    'field', field, 'before', before_value, 'after', after_value)::text
    from public.admin_activity where actor_id = '${MANAGER}' order by at desc limit 1`);
  check("the log says who, and that it was their first password",
    /"actor" : "Luis Ortega"/.test(log) && /"action" : "password"/.test(log) && /"field" : "first password"/.test(log), log);
  const leak = await one(`select count(*) from public.admin_activity
    where coalesce(before_value::text, '') || coalesce(after_value::text, '') || coalesce(field, '') || coalesce(entity_label, '')
      ~ '(hash|\\$2a\\$|new-manager|temp-manager)'`);
  check("and nothing in the log is a password or a hash", leak === "0", leak);

  // A later, voluntary change is logged as a change, not a first password.
  await supabaseStores(MANAGER, "$2a$10$newer-manager-hash");
  const again = await as(MANAGER, `select public.record_password_change();`);
  check("a later change is logged as a change", answer(again) === "f" &&
    (await one(`select field from public.admin_activity where actor_id = '${MANAGER}' order by at desc limit 1`)) === "password");

  // ------------------------------------------ forcing a change again, later
  await sql(`update public.staff set must_change_password = true where user_id = '${MANAGER}'`);
  check("setting the flag again remembers the password as it is now",
    (await one(`select fingerprint from public.staff_password_marks where user_id = '${MANAGER}'`)) === (await one(`select md5('$2a$10$newer-manager-hash')`)));
  check("and locks them out again until they change it",
    answer(await as(MANAGER, `select count(*) from public.orders;`)) === "0");

  // ------------------------------------------------------ a new account
  await sql(`insert into public.staff (user_id, role, display_name) values ('${LATER}', 'manager', 'New Hire')`);
  check("an account added later is flagged without anybody remembering to",
    (await one(`select must_change_password::text from public.staff where user_id = '${LATER}'`)) === "true" &&
      (await one(`select fingerprint from public.staff_password_marks where user_id = '${LATER}'`)) === (await one(`select md5('$2a$10$temp-later-hash')`)));

  // ------------------------------------------------------ nobody else
  const anon = await trySql(db.name, `set local role anon; select public.record_password_change();`);
  check("the anonymous key cannot call it", anon.code !== 0 && /permission denied/i.test(anon.err), anon.err.split("\n")[0]);
} finally {
  await db.drop();
}

report();
