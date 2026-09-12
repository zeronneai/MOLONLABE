// Names and values in queries, checked against the real schema.
//
// The "0 / 5" bug was a plausible name picked over the right one:
// `game_spots` instead of `game_spot_board`. Both exist, both are about
// spots, and the wrong one answers with an empty set rather than an
// error. `tests/db/anonreach.mjs` closes that exact shape — reading a
// relation the anonymous role cannot see.
//
// This closes the rest of the shape, because the same trap is set in
// three more places and none of them involves RLS at all:
//
//   1. A RELATION that does not exist. PostgREST 404s, the code logs and
//      returns [], and the page renders a zero.
//
//   2. A COLUMN that does not exist in a select. PostgREST errors, and
//      every call site in this codebase handles an error by returning an
//      empty result — so again, a zero.
//
//   3. A FILTER VALUE from the wrong vocabulary. This is the quiet one,
//      and it is quiet even in the database: `status` means four
//      different things here —
//
//        games.status        open | full | drawn
//        game_spots.status   open | held | sold
//        items.status        available | reserved | sold | hidden
//        orders.status       paid | fulfilled | cancelled | refunded
//
//      `.eq("status", "sold")` is correct on game_spots, correct on
//      items, and matches NOTHING on games or orders. `'open'` is valid
//      on both games and game_spots and means different things on each.
//      No error at any layer. Just zero rows, forever.
//
// Reading the source is the only place this can be caught. A running
// page cannot tell you the difference between a filter that matches
// nothing and a game nobody has bought into.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase } from "../lib/pg.mjs";

const { check, note, report } = suite();
const ROOT = join(import.meta.dirname, "..", "..");

const scratch = await scratchDatabase("namecheck");
const sql = scratch.sql;

try {
  // ------------------------------------------------------- the schema
  const columns = new Map(); // relation -> Set(column)
  for (const line of (await sql(`
    select c.relname || '|' || a.attname
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','v')
      and a.attnum > 0 and not a.attisdropped
    order by 1
  `)).split("\n").filter(Boolean)) {
    const [rel, col] = line.split("|");
    if (!columns.has(rel)) columns.set(rel, new Set());
    columns.get(rel).add(col);
  }

  // ------------------------------------------- the value vocabularies
  // From the check constraints, which is where most of them are pinned.
  const vocab = new Map(); // "relation.column" -> Set(value)
  for (const line of (await sql(`
    select c.conrelid::regclass::text || '|' || pg_get_constraintdef(c.oid)
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%= ANY %'
  `)).split("\n").filter(Boolean)) {
    const [rel, def] = line.split("|");
    const col = def.match(/CHECK \(\((\w+) = ANY/)?.[1];
    if (!col) continue;
    const values = [...def.matchAll(/'([^']+)'::text/g)].map((m) => m[1]);
    if (values.length) vocab.set(`${rel}.${col}`, new Set(values));
  }

  // items.status has NO database constraint — it is app-level only, in
  // lib/admin/constants.ts. Read it from there rather than leaving the
  // one status column nothing checks. If the two ever disagree, that is
  // worth knowing on its own.
  const constants = readFileSync(join(ROOT, "lib/admin/constants.ts"), "utf8");
  const itemStatuses = constants
    .match(/ITEM_STATUSES = \[([^\]]+)\]/)?.[1]
    .match(/"([a-z_]+)"/g)?.map((s) => s.replace(/"/g, ""));
  if (itemStatuses?.length) {
    vocab.set("items.status", new Set(itemStatuses));
    note(`items.status has no db constraint; using ITEM_STATUSES (${itemStatuses.join(", ")})`);
  }

  check("the schema was read", columns.size > 5, `${columns.size} relations`);
  check("value vocabularies were found", vocab.size >= 5,
    [...vocab.keys()].join(", "));

  // ------------------------------------------------------ the sources
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (["node_modules", ".next", ".git"].includes(entry)) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) files.push(p);
    }
  };
  walk(join(ROOT, "lib"));
  walk(join(ROOT, "app"));
  walk(join(ROOT, "components"));

  const badRelation = [];
  const badColumn = [];
  const badValue = [];
  let chains = 0;
  let filtersChecked = 0;

  for (const file of files) {
    const rel = file.replace(ROOT + "/", "");
    // Whitespace collapsed so a chain broken across lines reads as one
    // string. Comments are stripped first, or a table name mentioned in
    // prose gets treated as a query.
    const src = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ")
      .replace(/\s+/g, " ");

    for (const m of src.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)) {
      const relation = m[1];
      chains++;

      // Only relations this schema knows. `.from()` also appears on
      // storage buckets and on Array.from, which are not tables — the
      // name check below would flag those wrongly, so anything that is
      // not a known relation AND not referenced anywhere in the schema
      // is reported rather than assumed.
      if (!columns.has(relation)) {
        badRelation.push(`${rel}: .from("${relation}")`);
        continue;
      }

      // The chain runs to the next `.from(` or the end of the statement,
      // whichever comes first. Over-reaching would attribute one query's
      // filters to another, so the bound is deliberately tight.
      const start = m.index + m[0].length;
      const nextFrom = src.indexOf(".from(", start);
      const semi = src.indexOf(";", start);
      const end = Math.min(
        nextFrom === -1 ? src.length : nextFrom,
        semi === -1 ? src.length : semi,
      );
      const chain = src.slice(start, end);
      const cols = columns.get(relation);

      // ----------------------------------------------- select columns
      for (const s of chain.matchAll(/\.select\(\s*["'`]([^"'`]*)["'`]/g)) {
        for (const raw of s[1].split(",")) {
          const col = raw.trim();
          // `*`, an embed (`item:items(*)`), an alias, or a modifier —
          // none of which is a plain column on this relation.
          if (!col || col === "*" || col.includes("(") || col.includes(":")) continue;
          if (!cols.has(col)) {
            badColumn.push(`${rel}: ${relation}.select("${col}")`);
          }
        }
      }

      // ------------------------------------------ filter columns/values
      for (const f of chain.matchAll(
        /\.(eq|neq|gt|gte|lt|lte|is|in)\(\s*["'`]([a-z_]+)["'`]\s*,\s*([^)]*)\)/g,
      )) {
        const [, op, col, rawArg] = f;
        if (!cols.has(col)) {
          badColumn.push(`${rel}: ${relation}.${op}("${col}", …)`);
          continue;
        }
        const allowed = vocab.get(`${relation}.${col}`);
        if (!allowed) continue;
        // Only string literals. A variable could hold anything and is
        // not this test's business.
        const literals = [...rawArg.matchAll(/["'`]([a-z_]+)["'`]/g)].map((x) => x[1]);
        for (const value of literals) {
          filtersChecked++;
          if (!allowed.has(value)) {
            badValue.push(
              `${rel}: ${relation}.${op}("${col}", "${value}") — ` +
                `${relation}.${col} is one of ${[...allowed].join("|")}`,
            );
          }
        }
      }
    }
  }

  note(`${chains} query chains across ${files.length} files; ${filtersChecked} literal filter values`);

  check("every .from() names a relation that exists",
    badRelation.length === 0, badRelation.join("; ") || "all known");
  check("every selected and filtered column exists on its relation",
    badColumn.length === 0, badColumn.join("; ") || "all known");
  check("every literal filter value is from that column's vocabulary",
    badValue.length === 0, badValue.join("; ") || `${filtersChecked} checked`);

  // The overlap that makes this worth checking at all, asserted so the
  // reasoning above cannot quietly stop being true.
  const gameV = vocab.get("games.status");
  const spotV = vocab.get("game_spots.status");
  check("games.status and game_spots.status really are different vocabularies",
    gameV && spotV && [...gameV].join() !== [...spotV].join(),
    `games: ${[...(gameV ?? [])].join("|")} vs spots: ${[...(spotV ?? [])].join("|")}`);
  check("and they overlap, so a wrong one can look right",
    gameV && spotV && [...gameV].some((v) => spotV.has(v)),
    [...(gameV ?? [])].filter((v) => spotV?.has(v)).join(", "));
} finally {
  await scratch.drop();
}

report();
