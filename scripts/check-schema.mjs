#!/usr/bin/env node
// Does the database actually have the columns the application uses?
//
// Why this exists
// ---------------
// The winners table lost seed, ticket and entry_total, and the draw —
// the least reversible operation in the build — failed on every attempt.
// Nothing caught it, and it is worth being precise about why, because
// the gap is structural rather than an oversight:
//
//   - The unit and browser suites run against a local test double. The
//     double is schemaless: it stores whatever object it is handed. Code
//     writing a column that does not exist is, to the double, a normal
//     write. The suites agree with the code by construction.
//
//   - Applying the migration chain to an empty database also passes,
//     because the chain is correct. Both checks confirm the code agrees
//     with itself. Neither looks at the database the shop actually runs.
//
// So this connects to a real database and compares it against
// lib/database.types.ts, which is what every query in the app is typed
// against. Anything the code believes in that the database does not have
// is drift, and drift is what this prints.
//
// Usage
// -----
//   node scripts/check-schema.mjs          # reads .env.local, no setup
//   node scripts/check-schema.mjs --sql    # also print repair SQL
//
// It asks the live database what columns it has, through the same
// Supabase URL and service-role key the site already uses, so there is
// nothing to install and no extra credential. Run it after applying any
// migration.
//
// Exit codes: 0 clean, 1 drift found, 2 could not check.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const wantSql = process.argv.includes("--sql");

// --- what the code believes ------------------------------------------------

/**
 * Reads the table shapes out of lib/database.types.ts.
 *
 * Parsed rather than imported because this runs as plain node with no
 * TypeScript toolchain, and because the Row block is a flat list of
 * `name: type;` lines that does not need a real parser. Row is used —
 * not Insert or Update — because Row is the full shape of the table.
 */
function declaredTables() {
  const src = readFileSync(join(ROOT, "lib/database.types.ts"), "utf8");
  const tablesAt = src.indexOf("Tables: {");
  if (tablesAt < 0) throw new Error("no Tables block in database.types.ts");

  const tables = new Map();
  const tableRe = /^ {6}(\w+): \{$/gm;
  let m;
  while ((m = tableRe.exec(src))) {
    if (m.index < tablesAt) continue;
    const name = m[1];
    const rowAt = src.indexOf("Row: {", m.index);
    if (rowAt < 0) continue;
    const rowEnd = src.indexOf("};", rowAt);
    const body = src.slice(rowAt + "Row: {".length, rowEnd);
    const cols = new Map();
    for (const line of body.split("\n")) {
      const c = line.match(/^\s*(\w+)(\??):\s*(.+);\s*$/);
      if (!c) continue;
      cols.set(c[1], { optional: c[2] === "?", type: c[3].trim() });
    }
    if (cols.size) tables.set(name, cols);
  }
  return tables;
}

// --- what the database has -------------------------------------------------

/** Values from the environment, falling back to .env.local. */
function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const file = readFileSync(join(ROOT, ".env.local"), "utf8");
    const hit = file.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
    if (hit) return hit[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env.local is normal in CI */
  }
  return null;
}

/**
 * Reads the live schema from PostgREST's OpenAPI document.
 *
 * This is the path the agency and the shop will use, and it is
 * deliberately dependency-free: `fetch` plus the two values already in
 * .env.local. No database password, no psql, nothing new to install —
 * because a check that needs setting up is a check that gets skipped,
 * and this one is only useful if it is easy enough to run every time a
 * migration is applied.
 */
async function schemaFromPostgrest(url, key) {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(
      `PostgREST returned ${res.status}. Check the URL and that the key is ` +
        `the service-role key rather than the anon key.`,
    );
  }
  const spec = await res.json();
  const defs = spec.definitions ?? spec.components?.schemas ?? {};
  const tables = new Map();
  for (const [name, def] of Object.entries(defs)) {
    const cols = new Map();
    for (const [col, meta] of Object.entries(def.properties ?? {})) {
      cols.set(col, { type: meta.format ?? meta.type ?? "unknown" });
    }
    if (cols.size) tables.set(name, cols);
  }
  return tables;
}

/**
 * The same question asked over a direct connection, for CI and for anyone
 * who has psql to hand. Shells out rather than taking a driver
 * dependency, for the same reason as above.
 */
async function schemaFromPsql(conn) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const sql =
    "select table_name || '\t' || column_name from information_schema.columns " +
    "where table_schema = 'public' order by table_name, ordinal_position";
  const { stdout } = await run("psql", [conn, "-t", "-A", "-F", "\t", "-c", sql], {
    maxBuffer: 8 << 20,
  });
  const tables = new Map();
  for (const line of stdout.split("\n")) {
    const [table, col] = line.split("\t");
    if (!table || !col) continue;
    if (!tables.has(table)) tables.set(table, new Map());
    tables.get(table).set(col, { type: "unknown" });
  }
  return tables;
}

/** A best-effort ALTER for a missing column, to be reviewed not pasted blind. */
function repairFor(type) {
  const t = type.replace(/\s*\|\s*null/, "").trim();
  if (/^number$/.test(t)) return "integer";
  if (/^boolean$/.test(t)) return "boolean";
  if (/^Json$/.test(t)) return "jsonb";
  if (/^string\[\]$/.test(t)) return "text[]";
  return "text";
}

// --- compare ---------------------------------------------------------------

const dbUrl = env("DATABASE_URL");
const sbUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const sbKey = env("SUPABASE_SERVICE_ROLE_KEY");

let actual;
try {
  if (dbUrl) {
    actual = await schemaFromPsql(dbUrl);
  } else if (sbUrl && sbKey) {
    actual = await schemaFromPostgrest(sbUrl, sbKey);
  } else {
    console.error(
      "No database to check.\n\n" +
        "Either set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n" +
        "(both are already in .env.local for a working site), or set\n" +
        "DATABASE_URL to a connection string and have psql installed.\n\n" +
        "This check is the only one that looks at the real database — the\n" +
        "test suites run against a double and cannot see drift.",
    );
    process.exit(2);
  }
} catch (e) {
  console.error(`Could not read the schema: ${e.message}`);
  process.exit(2);
}

const declared = declaredTables();
const missingCols = [];
const missingTables = [];
const extraCols = [];

for (const [table, cols] of declared) {
  const real = actual.get(table);
  if (!real) {
    missingTables.push(table);
    continue;
  }
  for (const [col, meta] of cols) {
    if (!real.has(col)) missingCols.push({ table, col, type: meta.type });
  }
  for (const col of real.keys()) {
    if (!cols.has(col)) extraCols.push({ table, col });
  }
}

const drift = missingTables.length + missingCols.length;

if (missingTables.length) {
  console.log("TABLES THE CODE USES THAT THE DATABASE DOES NOT HAVE\n");
  for (const t of missingTables) console.log(`  ${t}`);
  console.log("");
}

if (missingCols.length) {
  console.log("COLUMNS THE CODE USES THAT THE DATABASE DOES NOT HAVE\n");
  for (const { table, col, type } of missingCols) {
    console.log(`  ${table}.${col}   (code expects ${type})`);
  }
  console.log(
    "\nEvery query touching these fails at runtime. A migration is missing,\n" +
      "or one was applied out of order.\n",
  );
  if (wantSql) {
    console.log("Suggested repair — review before running:\n");
    for (const { table, col, type } of missingCols) {
      console.log(
        `alter table public.${table} add column if not exists ${col} ${repairFor(type)};`,
      );
    }
    console.log("");
  } else {
    console.log("Re-run with --sql for suggested ALTER statements.\n");
  }
}

// Extra columns are reported but do not fail: a column the code has
// stopped using is harmless, and failing on it would make this check
// annoying enough to be switched off, which is how checks die.
if (extraCols.length) {
  console.log("Columns in the database that the code no longer declares:\n");
  for (const { table, col } of extraCols) console.log(`  ${table}.${col}`);
  console.log("\n(Harmless. Listed so the list does not grow unnoticed.)\n");
}

if (drift === 0) {
  const cols = [...declared.values()].reduce((n, c) => n + c.size, 0);
  console.log(
    `Schema matches: ${declared.size} tables, ${cols} columns, all present.`,
  );
}

process.exit(drift === 0 ? 0 : 1);
