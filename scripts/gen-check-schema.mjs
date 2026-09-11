#!/usr/bin/env node
// Regenerates scripts/check-schema.sql from lib/database.types.ts.
//
//   node scripts/gen-check-schema.mjs > scripts/check-schema.sql
//
// There are two versions of the schema check and they answer the same
// question from the same source:
//
//   scripts/check-schema.mjs  — needs a clone and node, talks to the
//                               database, prints a report.
//   scripts/check-schema.sql  — needs neither. Paste into the Supabase
//                               SQL editor. For whoever is holding the
//                               problem without the repo to hand, which
//                               is the situation this was written in.
//
// The SQL one embeds the expected column list, so it has to be
// regenerated whenever database.types.ts changes. That is what this is
// for — a stale checker that reports "all clear" is worse than none.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Same parse as check-schema.mjs, so the two cannot disagree. */
function declaredTables() {
  const src = readFileSync(join(ROOT, "lib/database.types.ts"), "utf8");
  const tablesAt = src.indexOf("Tables: {");
  if (tablesAt < 0) throw new Error("no Tables block in database.types.ts");
  const out = [];
  const tableRe = /^ {6}(\w+): \{$/gm;
  let m;
  while ((m = tableRe.exec(src))) {
    if (m.index < tablesAt) continue;
    const rowAt = src.indexOf("Row: {", m.index);
    if (rowAt < 0) continue;
    const body = src.slice(rowAt + "Row: {".length, src.indexOf("};", rowAt));
    for (const line of body.split("\n")) {
      const c = line.match(/^\s*(\w+)(\??):\s*(.+);\s*$/);
      if (c) out.push({ table: m[1], column: c[1] });
    }
  }
  return out;
}

const rows = declaredTables();
if (rows.length < 50) throw new Error(`only parsed ${rows.length} columns — the parser is broken`);

const values = rows
  .sort((a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column))
  .map((r) => `  ('${r.table}','${r.column}')`)
  .join(",\n");

process.stdout.write(`-- Schema drift check — pure SQL. No clone, no tooling, nothing to install.
--
-- Paste the whole thing into the Supabase SQL editor and run it. It
-- compares this database against the schema the application expects and
-- returns ONE ROW PER PROBLEM — nothing at all if the database is right.
--
-- It is shaped this way on purpose. Dumping information_schema and
-- reading it by eye does not work: the listing runs to hundreds of rows,
-- editors cap results (100 is a common default), and the cap lands in the
-- middle of a table without saying so — which reads exactly like missing
-- columns. This returns only discrepancies, so a cap cannot turn it into
-- a wrong answer.
--
-- It reads nothing and writes nothing. Safe on production, any time.
--
-- GENERATED FILE — do not edit. Regenerate after changing
-- lib/database.types.ts:
--   node scripts/gen-check-schema.mjs > scripts/check-schema.sql
--
-- Expecting ${rows.length} columns across ${new Set(rows.map((r) => r.table)).size} tables.

with expected(table_name, column_name) as (values
${values}
),
actual as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
),
present as (
  select table_name from information_schema.tables where table_schema = 'public'
  union
  select table_name from information_schema.views where table_schema = 'public'
)
select 'MISSING TABLE' as problem,
       e.table_name,
       '(the whole table)' as column_name,
       'A migration that creates it has not been applied. Run that migration in full.' as meaning
from (select distinct table_name from expected) e
where e.table_name not in (select table_name from present)

union all

select 'MISSING COLUMN', e.table_name, e.column_name,
       'Every query touching this fails at runtime.'
from expected e
where e.table_name in (select table_name from present)
  and not exists (
    select 1 from actual a
    where a.table_name = e.table_name and a.column_name = e.column_name
  )

union all

-- Reported, but not something to act on: a column the application has
-- stopped declaring. Listed so the list does not grow unnoticed.
select 'EXTRA COLUMN', a.table_name, a.column_name,
       'Harmless — the app no longer declares this. No action needed.'
from actual a
where a.table_name in (select distinct table_name from expected)
  and not exists (
    select 1 from expected e
    where e.table_name = a.table_name and e.column_name = a.column_name
  )

order by 1, 2, 3;
`);
