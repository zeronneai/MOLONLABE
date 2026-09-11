#!/usr/bin/env node
// Generates supabase/repair/baseline.sql — one script that converges any
// database to the current schema in a single pass.
//
//   node scripts/gen-baseline.mjs "postgres://…/reference_db" > supabase/repair/baseline.sql
//
// The reference database must be one built by applying the full
// migration chain to an empty database. This reads its actual shape and
// emits the idempotent form of it, so the baseline cannot drift from the
// chain by transcription error — it is derived from the chain's own
// output rather than written alongside it.
//
// Why a baseline at all. The chain is not re-runnable: nine of fourteen
// migrations abort against an already-migrated database, because each one
// transforms a known previous state into the next. That makes the chain
// useless for repair, and repairing piecemeal means discovering the next
// missing piece by accident. This converges from ANY state — empty,
// partial, or current — in one run, and says so verifiably: the
// generated script is tested by applying it to an empty database, to a
// damaged one, and twice in a row, then diffing against the reference.
//
// It only ever adds. No drop table, no drop column, no data touched.

import { execFileSync } from "node:child_process";

const conn = process.argv[2];
if (!conn) {
  console.error("usage: node scripts/gen-baseline.mjs <connection string>");
  process.exit(2);
}

/**
 * Runs a query and returns rows of strings.
 *
 * Every column is base64-encoded on the server and decoded here. That
 * looks like a detour, but view definitions, function bodies and policy
 * expressions all contain newlines, and psql's line-per-row output
 * cannot represent them — an earlier version of this silently truncated
 * the first view it met. Encoding removes the whole class of problem
 * rather than picking a delimiter and hoping.
 */
const SEP = "\u0001";

const q = (sql) => {
  const wrapped = sql.replace(
    /^\s*select\s+([\s\S]+?)\s+from\s/i,
    (_m, cols) =>
      "select " +
      splitTopLevel(cols)
        .map(
          (c) =>
            `replace(encode(convert_to(coalesce((${c})::text,''),'UTF8'),'base64'), E'\\n','')`,
        )
        .join(", ") +
      " from ",
  );
  return execFileSync("psql", [conn, "-t", "-A", "-F", SEP, "-c", wrapped], {
    maxBuffer: 64 << 20,
  })
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split(SEP).map((v) => Buffer.from(v, "base64").toString("utf8")));
};

/** Splits a SELECT list on commas that are not inside brackets or quotes. */
function splitTopLevel(cols) {
  const out = [];
  let depth = 0, quote = null, cur = "";
  for (const ch of cols) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const out = [];
const w = (s = "") => out.push(s);

// ---------------------------------------------------------------- tables
const tables = q(`
  select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
`).map((r) => r[0]);

// Full column definitions, so a missing table can be created outright.
const colsFor = (t) =>
  q(`
    select a.attname,
           format_type(a.atttypid, a.atttypmod),
           a.attnotnull,
           coalesce(pg_get_expr(d.adbin, d.adrelid), '')
    from pg_attribute a
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = 'public.${t}'::regclass
      and a.attnum > 0 and not a.attisdropped
    order by a.attnum
  `);

w(`-- The schema, expressed so it can be applied to a database in any state.
--
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   node scripts/gen-baseline.mjs <connection to a chain-built database>
--
-- WHAT THIS IS FOR
--
-- The migration chain cannot be re-run to repair a database: nine of its
-- fourteen migrations abort against one that is already migrated, because
-- each transforms a known previous state into the next. Repairing column
-- by column instead means finding the next missing piece by accident.
--
-- This converges in one pass from any starting point — empty, partially
-- applied, or already correct. Run it, then run scripts/check-schema.sql
-- and confirm that returns nothing. That is the whole procedure.
--
-- WHAT IT WILL NOT DO
--
-- It only adds. There is no drop table, no drop column, no delete and no
-- update anywhere in it, so it cannot lose data or lose a column that
-- something else still depends on. A column in your database that the
-- schema no longer has is left alone; check-schema.sql lists those
-- separately as harmless.
--
-- It does not replace the migration chain for NEW changes. New work still
-- gets a migration; this file is regenerated from the chain afterwards.
--
-- Safe to run more than once.

begin;
`);

w(`-- ---------------------------------------------------------------------
-- Tables and columns
-- ---------------------------------------------------------------------
-- Each table is created if absent, then every column is added if absent.
-- The two together cover a missing table, a table missing some columns,
-- and a table that is already correct.
`);

for (const t of tables) {
  const cols = colsFor(t);
  const defs = cols
    .map(([name, type, notnull, def]) => {
      const d = def ? ` default ${def}` : "";
      // NOT NULL is only safe on a fresh table; adding it to an existing
      // one with rows would fail. Applied here, omitted below.
      // Cast to text by the query helper, so booleans read
      // 'true'/'false' rather than 't'/'f'. Getting this wrong silently
      // dropped every NOT NULL from the generated script.
      const nn = notnull === "true" ? " not null" : "";
      return `  ${name} ${type}${d}${nn}`;
    })
    .join(",\n");
  w(`create table if not exists public.${t} (\n${defs}\n);`);
  for (const [name, type, notnull, def] of cols) {
    const d = def ? ` default ${def}` : "";
    // The column is added WITHOUT not-null, because an existing table may
    // already hold rows and a new not-null column without a default would
    // be rejected outright.
    w(`alter table public.${t} add column if not exists ${name} ${type}${d};`);
    if (notnull === "true") {
      // Then not-null is applied separately, and only when it can be:
      // if existing rows hold a null the alter would abort the whole
      // script, so it is skipped with a notice instead. Leaving one
      // column nullable is recoverable; refusing to converge is not.
      w(`do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = '${t}'
      and column_name = '${name}' and is_nullable = 'YES'
  ) then
    if exists (select 1 from public.${t} where ${name} is null) then
      raise notice 'public.${t}.${name} holds nulls; left nullable. Fill them, then: alter table public.${t} alter column ${name} set not null;';
    else
      alter table public.${t} alter column ${name} set not null;
    end if;
  end if;
end $$;`);
    }
  }
  w("");
}

// ------------------------------------------------------------------ views
const views = q(`
  select table_name, view_definition
  from information_schema.views
  where table_schema = 'public'
  order by table_name
`);
if (views.length) {
  w(`-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------
`);
  for (const [name, def] of views) {
    w(`create or replace view public.${name} as\n${def.trim().replace(/;$/, "")};`);
    w("");
  }
}

// ------------------------------------------------------------- constraints
// Ordered by KIND first, not by table. A foreign key cannot be added
// before the primary or unique key it references exists, and emitting
// alphabetically by table put game_spots_game_id_fkey ahead of
// games_pkey — which fails on an empty database while passing on one
// that already has the keys. Primary and unique first, then checks, then
// foreign keys last.
const constraints = q(`
  select c.conname, c.conrelid::regclass::text, pg_get_constraintdef(c.oid)
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public'
  order by case c.contype when 'p' then 0 when 'u' then 1 when 'c' then 2
                          when 'f' then 3 else 4 end,
           c.conrelid::regclass::text, c.conname
`);
w(`-- ---------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------
-- Added only when absent. A constraint that exists is left exactly as it
-- is rather than dropped and recreated, so this cannot briefly open a
-- window where the rule is not enforced.
`);
for (const [name, table, def] of constraints) {
  // Primary keys and uniques arrive as index-backed constraints; the
  // form below covers all of them.
  w(`do $$ begin
  if not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = '${name}'
      and c.conrelid = '${table}'::regclass
  ) then
    alter table ${table} add constraint ${name} ${def};
  end if;
end $$;`);
}
w("");

// ----------------------------------------------------------------- indexes
const indexes = q(`
  select indexname, indexdef from pg_indexes
  where schemaname = 'public' order by indexname
`);
w(`-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
-- Indexes that back a primary key or unique constraint are skipped: the
-- constraint above already created them, and creating them again fails.
`);
const constraintIndexes = new Set(constraints.map(([n]) => n));
for (const [name, def] of indexes) {
  if (constraintIndexes.has(name)) continue;
  w(`${def.replace(/^create (unique )?index /i, (m, u) => `create ${u ?? ""}index if not exists `)};`);
}
w("");

// --------------------------------------------------------------- functions
const functions = q(`
  select pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
  order by p.proname
`);
w(`-- ---------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------
-- CREATE OR REPLACE, so an older definition is brought up to date rather
-- than left in place.
`);
for (const [def] of functions) {
  // pg_get_functiondef returns the definition WITHOUT a terminating
  // semicolon, so one is added here — otherwise the next statement is
  // parsed as part of this function's trailing clauses.
  const body = def
    .replace(/^CREATE OR REPLACE FUNCTION/i, "create or replace function")
    .replace(/^CREATE FUNCTION/i, "create or replace function")
    .trimEnd();
  w(body.endsWith(";") ? body : `${body};`);
  w("");
}

// ------------------------------------------------------------------- RLS
w(`-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
`);
const rls = q(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  order by c.relname
`).map((r) => r[0]);
for (const t of rls) w(`alter table public.${t} enable row level security;`);
w("");

// -------------------------------------------------------------- policies
const policies = q(`
  select tablename, policyname, permissive, roles::text, cmd,
         coalesce(qual, ''), coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
  order by tablename, policyname
`);
w(`-- Policies are dropped and recreated, because unlike a constraint a
-- policy's definition can have changed while its name stayed the same,
-- and there is no "replace" form. Inside the transaction, so no request
-- ever sees the table unprotected.
`);
for (const [table, name, permissive, roles, cmd, qual, check] of policies) {
  const to = roles.replace(/[{}]/g, "");
  w(`drop policy if exists "${name}" on public.${table};`);
  w(
    `create policy "${name}" on public.${table}` +
      (permissive === "PERMISSIVE" ? "" : " as restrictive") +
      ` for ${cmd.toLowerCase()}` +
      (to ? ` to ${to}` : "") +
      (qual ? `\n  using (${qual})` : "") +
      (check ? `\n  with check (${check})` : "") +
      ";",
  );
}
w("");

// ----------------------------------------------------------------- grants
const grants = q(`
  select grantee, privilege_type, table_name
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
  order by table_name, grantee, privilege_type
`);
if (grants.length) {
  w(`-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
`);
  for (const [grantee, priv, table] of grants) {
    w(`grant ${priv.toLowerCase()} on public.${table} to ${grantee};`);
  }
  w("");
}

const fnGrants = q(`
  select p.proname, pg_get_function_identity_arguments(p.oid), r.rolname,
         has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join (select rolname from pg_roles where rolname in ('anon','authenticated')) r
  where n.nspname = 'public' and p.prokind = 'f'
  order by p.proname, r.rolname
`);
if (fnGrants.length) {
  w(`-- Execute privileges. The revokes matter as much as the grants: the
-- spot-claiming and checkout functions must not be callable from a
-- browser, and CREATE OR REPLACE above resets them to the default.
`);
  for (const [name, args, role, allowed] of fnGrants) {
    const verb = allowed === "true" ? "grant" : "revoke";
    const dir = allowed === "true" ? "to" : "from";
    w(`${verb} execute on function public.${name}(${args}) ${dir} ${role};`);
  }
  w("");
}

w(`commit;

-- Now confirm it: run scripts/check-schema.sql. It should return no rows.`);

process.stdout.write(out.join("\n") + "\n");
