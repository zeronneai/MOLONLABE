// The repair script converges to the same database the migrations build.
//
// supabase/repair/baseline.sql is what gets pasted into the SQL editor
// when a live database has drifted. It is generated from a chain-built
// reference, and it used to be checked by hand when somebody remembered.
// A stale baseline is worse than none: it reports success and leaves the
// database short.
//
// Two starting points, because they fail differently:
//
//   EMPTY, applied twice. Proves it builds everything and that running
//   it again changes nothing.
//
//   PRODUCTION AS IT STANDS before the roles migration, with accounts in
//   it. This is the case that matters for October: the baseline has to
//   REMOVE the old "any signed-in account" policies, not merely add the
//   new ones beside them, because permissive policies are OR'ed and one
//   leftover would let a manager do everything. It also has to leave the
//   existing accounts able to sign in, as owners.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { suite } from "../lib/harness.mjs";
import { PG } from "../lib/config.mjs";

const { check, report } = suite();
const ROOT = join(import.meta.dirname, "..", "..");
const run = promisify(execFile);
const base = ["-h", PG.host, "-p", PG.port, "-U", PG.user];
const psql = (db, args) =>
  run("psql", [...base, "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...args], {
    maxBuffer: 64 << 20,
  });
const one = async (db, text) =>
  (await run("psql", [...base, "-d", db, "-t", "-A", "-c", text])).stdout.trim();

/** The schema as a sorted list of lines, so ordering cannot cause a diff. */
async function shape(db) {
  const { stdout } = await run("pg_dump", [
    ...base, "-s", "-n", "public", "-n", "storage",
    "-T", "public._test_template_fingerprint", db,
  ], { maxBuffer: 64 << 20 });
  return stdout
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("--") && !/^\\(un)?restrict/.test(l))
    .sort();
}

function difference(a, b) {
  const left = new Map(), right = new Map();
  for (const l of a) left.set(l, (left.get(l) ?? 0) + 1);
  for (const l of b) right.set(l, (right.get(l) ?? 0) + 1);
  const out = [];
  for (const [l, n] of left) if ((right.get(l) ?? 0) < n) out.push(`- ${l.trim()}`);
  for (const [l, n] of right) if ((left.get(l) ?? 0) < n) out.push(`+ ${l.trim()}`);
  return out;
}

const STUB = join(ROOT, "tests/fixtures/platform-stub.sql");
const BASELINE = join(ROOT, "supabase/repair/baseline.sql");
const migrations = readdirSync(join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const made = [];
async function fresh(label) {
  const name = `mlf_${label}_${randomBytes(4).toString("hex")}`;
  await run("psql", [...base, "-d", "postgres", "-c", `create database ${name}`]);
  made.push(name);
  await psql(name, ["-f", STUB]);
  return name;
}

try {
  const reference = await shape(PG.template);

  // ---------------------------------------------------------- empty
  const empty = await fresh("bl_empty");
  await psql(empty, ["-f", BASELINE]);
  await psql(empty, ["-f", BASELINE]);
  const diffEmpty = difference(reference, await shape(empty));
  check("the baseline, applied twice to an empty database, matches the migrations",
    diffEmpty.length === 0, diffEmpty.slice(0, 6).join(" | "));

  // ----------------------------------------------- production today
  const prod = await fresh("bl_prod");
  for (const f of migrations.filter((f) => !f.includes("staff_roles"))) {
    await psql(prod, ["-f", join(ROOT, "supabase/migrations", f)]);
  }
  await psql(prod, ["-c", `
    insert into auth.users (id, email, raw_user_meta_data) values
      (gen_random_uuid(), 'owner@example.com', '{"full_name":"Rey Marquez"}'),
      (gen_random_uuid(), 'agency@example.com', null);`]);
  const open = await one(prod,
    "select count(*) from pg_policies where schemaname = 'public' and qual = 'true' and 'authenticated' = any(roles) and roles = '{authenticated}'");
  check("the pre-roles database really does have open policies to remove", Number(open) > 0, open);

  await psql(prod, ["-f", BASELINE]);
  const diffProd = difference(reference, await shape(prod));
  check("applied to production as it stands, it converges to the same schema",
    diffProd.length === 0, diffProd.slice(0, 6).join(" | "));
  const left = await one(prod,
    "select count(*) from pg_policies where schemaname = 'public' and roles = '{authenticated}' and coalesce(qual, '') || coalesce(with_check, '') not like '%is_staff%' and coalesce(qual, '') || coalesce(with_check, '') not like '%is_owner%' and coalesce(qual, '') || coalesce(with_check, '') not like '%auth.uid%'");
  check("and no policy is left that lets any signed-in account through", left === "0", left);
  const owners = await one(prod, "select string_agg(role || ':' || display_name, ', ' order by display_name) from public.staff");
  check("the accounts that existed are owners afterwards, not locked out",
    owners === "owner:Owner (set a name), owner:Rey Marquez", owners);

  // A manager added afterwards is not promoted by a second run.
  await psql(prod, ["-c", "insert into auth.users (id, email) values (gen_random_uuid(), 'manager@example.com')"]);
  await psql(prod, ["-f", BASELINE]);
  await psql(prod, ["-f", join(ROOT, "supabase/migrations", migrations.find((f) => f.includes("staff_roles")))]);
  const after = await one(prod, "select count(*) from public.staff");
  check("running the baseline or the roles migration again makes nobody new an owner",
    after === "2", `${after} staff rows`);
} finally {
  for (const name of made) {
    await run("psql", [...base, "-d", "postgres", "-c", `drop database if exists ${name}`]).catch(() => {});
  }
}

report();
