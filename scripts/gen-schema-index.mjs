#!/usr/bin/env node
// Which migration adds which column.
//
//   node scripts/gen-schema-index.mjs                 # print the map
//   node scripts/gen-schema-index.mjs games.guide_why # one column
//   node scripts/gen-schema-index.mjs --write         # emit the module
//   node scripts/gen-schema-index.mjs --check         # is the module stale?
//
// UNFINISHED. The generator is correct and useful on its own -- it will
// tell you which migration adds any column -- but NOTHING IN THE APP
// READS ITS OUTPUT YET. `--write` emits lib/db/schema.generated.ts for
// the day the running application uses it; until then the file is not
// committed and not part of the build, because a generated file nothing
// consumes is a file that goes stale in silence.
//
// What is still to do: have lib/db/log.ts recognise a PGRST204 and name
// the migration, and have the admin say plainly when the live schema is
// behind. See docs/handover.md, "A missing migration is invisible".
//
// WHY
//
// A column the code uses and the database does not have has now produced
// four different symptoms, none of which pointed at the cause: a blank
// space in a PDF, a save that failed with "try again", a count that never
// rendered, and a guide that quietly stopped rebuilding. Every one of
// them was found from the symptom, days later.
//
// The information needed to say the true thing was always available — the
// migration that adds the column is sitting in supabase/migrations with
// the column name in it. It just was not anywhere the running app could
// reach. So it is compiled in:
//
//   EXPECTED_COLUMNS   every table and column lib/database.types.ts
//                      declares, which is what every query is typed
//                      against
//   COLUMN_MIGRATION   "games.guide_images_wanted" -> the migration
//                      filename that adds it
//   MIGRATIONS         every migration, in the order they apply
//
// With those three, a PGRST204 stops reading "could not find the column"
// and starts reading "apply 20260927100000_guide_image_count.sql".

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "lib", "db", "schema.generated.ts");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

/**
 * The tables and columns the code believes in.
 *
 * Parsed out of the Row blocks in lib/database.types.ts — Row, because
 * that is the full shape of the table, where Insert and Update are
 * partial views of it. Same parse `check-schema.mjs` and the test double
 * use; three readers of one declaration is better than three
 * declarations.
 */
function expectedColumns() {
  const src = readFileSync(join(ROOT, "lib/database.types.ts"), "utf8");
  const tablesAt = src.indexOf("Tables: {");
  const tables = {};
  const re = /^ {6}(\w+): \{$/gm;
  let m;
  while ((m = re.exec(src))) {
    if (m.index < tablesAt) continue;
    const rowAt = src.indexOf("Row: {", m.index);
    if (rowAt < 0) continue;
    const body = src.slice(rowAt, src.indexOf("};", rowAt));
    const cols = [];
    for (const line of body.split("\n")) {
      const c = line.match(/^\s*(\w+)\??:\s*.+;\s*$/);
      if (c && c[1] !== "Row") cols.push(c[1]);
    }
    if (cols.length) tables[m[1]] = cols;
  }
  return tables;
}

/**
 * Which migration puts each column there.
 *
 * THE LAST ONE THAT ADDS IT WINS, deliberately. This schema has been
 * rebuilt once — the fixed-pool change dropped and recreated tables — so
 * a column can be added in August and added again in September. The
 * answer somebody needs when a column is missing is "which file do I
 * apply", and that is always the later one.
 *
 * Two forms are recognised, which is every form this repo uses:
 *
 *   create table [if not exists] public.x ( a text, b int, ... )
 *   alter table public.x add column [if not exists] a text[, add column ...]
 *
 * Anything it cannot parse simply has no entry, and the caller falls
 * back to naming no migration rather than naming a wrong one.
 */
function columnMigrations(files) {
  const origin = {};

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8")
      // Strip line comments so a column named in prose does not count.
      .replace(/^\s*--.*$/gm, "");

    // create table … ( … )
    const createRe =
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\s*\);/gi;
    let m;
    while ((m = createRe.exec(sql))) {
      const table = m[1];
      for (const line of m[2].split("\n")) {
        const col = line.match(/^\s*(\w+)\s+[a-z]/i);
        if (!col) continue;
        const name = col[1].toLowerCase();
        // Table-level constraints start with these words, not a column.
        if (["primary", "unique", "foreign", "constraint", "check", "exclude"].includes(name))
          continue;
        origin[`${table}.${name}`] = file;
      }
    }

    // alter table … add column …, add column …
    const alterRe = /alter\s+table\s+(?:only\s+)?(?:public\.)?(\w+)([\s\S]*?);/gi;
    while ((m = alterRe.exec(sql))) {
      const table = m[1];
      const addRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi;
      let a;
      while ((a = addRe.exec(m[2]))) {
        origin[`${table}.${a[1].toLowerCase()}`] = file;
      }
    }
  }
  return origin;
}

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const columns = expectedColumns();
const origins = columnMigrations(migrations);

const stamp = createHash("sha256");
for (const f of migrations) {
  stamp.update(f);
  stamp.update(readFileSync(join(MIGRATIONS_DIR, f)));
}
stamp.update(readFileSync(join(ROOT, "lib/database.types.ts")));

const wanted = `// GENERATED FILE — do not edit by hand.
//
// Written by scripts/gen-schema-index.mjs --write. Nothing reads it yet;
// it exists so the running application can one day name the
// migration that adds a column the database is missing, instead of
// reporting the symptom and leaving somebody to work backwards from a
// blank space in a PDF.
//
// See the header of that script for what is still to do.

/** Every migration, in the order they apply. */
export const MIGRATIONS: readonly string[] = ${JSON.stringify(migrations, null, 2)};

/** What lib/database.types.ts declares, which every query is typed against. */
export const EXPECTED_COLUMNS: Readonly<Record<string, readonly string[]>> =
${JSON.stringify(columns, null, 2)};

/** "table.column" -> the migration filename that adds it. */
export const COLUMN_MIGRATION: Readonly<Record<string, string>> =
${JSON.stringify(origins, null, 2)};

/** Changes whenever the migrations or the declared types change. */
export const SCHEMA_INDEX_STAMP = "${stamp.digest("hex").slice(0, 16)}";
`;

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

// Default: answer the question somebody actually has, on stdout.
if (!process.argv.includes("--write") && !process.argv.includes("--check")) {
  if (args.length > 0) {
    for (const key of args) {
      const found = origins[key.toLowerCase()];
      console.log(`${key}  ${found ?? "not added by any migration"}`);
    }
    process.exit(args.every((k) => origins[k.toLowerCase()]) ? 0 : 1);
  }
  console.log(
    `${migrations.length} migrations, ` +
      `${Object.values(columns).flat().length} declared columns, ` +
      `${Object.keys(origins).length} mapped\n`,
  );
  for (const [key, file] of Object.entries(origins).sort()) {
    console.log(`  ${key.padEnd(40)} ${file}`);
  }
  process.exit(0);
}

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* missing counts as stale */
  }
  if (current !== wanted) {
    console.error(
      `lib/db/schema.generated.ts is stale.\n` +
        `A migration or lib/database.types.ts changed and the index did not,\n` +
        `so the app would name the wrong migration — or none — when the live\n` +
        `database turns out to be missing a column.\n\n` +
        `Run: node scripts/gen-schema-index.mjs --write`,
    );
    process.exit(1);
  }
  console.log(
    `schema index current — ${migrations.length} migrations, ` +
      `${Object.keys(origins).length} columns mapped`,
  );
  process.exit(0);
}

writeFileSync(OUT, wanted);
console.log(
  `schema index: ${migrations.length} migrations, ` +
    `${Object.values(columns).flat().length} declared columns, ` +
    `${Object.keys(origins).length} mapped to a migration`,
);
