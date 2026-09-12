// What the public pages are allowed to read, checked against what they
// actually read.
//
// THIS IS THE TEST THAT WOULD HAVE CAUGHT THE ZERO.
//
// The games list counted sold spots straight from `game_spots` using the
// anonymous key. That table is authenticated-only — it holds buyer names
// and email addresses — and row level security answers an unauthorised
// select with an EMPTY SET rather than an error. So the query succeeded,
// returned nothing, and every game on the home page read "0 / N" for
// weeks while spots were selling.
//
// Nothing in the suite could have found it, for two separate reasons,
// and both are closed here:
//
//   1. The browser suites run against the test double, which implements
//      no row level security at all. Under the double the anonymous key
//      reads everything, so the bug is invisible by construction — the
//      double would have to grow a whole permissions model to see it.
//      This runs against real PostgreSQL with the real policies instead.
//
//   2. Nothing checked WHICH CLIENT reads WHICH TABLE. That is a fact
//      about the source, not about any one page, so no amount of
//      clicking through the app finds it reliably — the wrong answer
//      looks exactly like a game with no sales.
//
// So this asserts both halves: what anon can actually reach in a real
// database, and that the public query layer reaches for nothing else.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase } from "../lib/pg.mjs";

const { check, note, report } = suite();
const ROOT = join(import.meta.dirname, "..", "..");

const scratch = await scratchDatabase("anonreach");
const sql = scratch.sql;

/**
 * Runs a query as the anonymous role.
 *
 * psql prints the `SET` command tag on its own line before the query's
 * output, so the last line is the answer. Reading the whole string
 * instead makes every assertion compare against "SET" and fail for a
 * reason that has nothing to do with what is being tested.
 */
const asAnon = async (text) => {
  const out = await sql(`set role anon; ${text}`);
  const lines = out.split("\n").filter((l) => l.trim() !== "");
  return lines[lines.length - 1] ?? "";
};

try {
  // Supabase grants select on public tables to anon and authenticated and
  // uses RLS as the gate. The scratch template is built from the
  // migrations alone, so the grants are applied here — otherwise the
  // test would prove the wrong thing: every table would come back
  // "permission denied" and the silent-empty-set behaviour that caused
  // the bug would never be exercised.
  await sql(`
    grant usage on schema public to anon, authenticated;
    grant select on all tables in schema public to anon, authenticated;
  `);

  // ------------------------------------------------------------------
  // 1. What can anon actually read?
  // ------------------------------------------------------------------
  const relations = (await sql(`
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v')
    order by c.relname
  `)).split("\n").filter(Boolean);

  // Readability is read from the catalogue rather than probed with a
  // select, because an empty table and a table RLS is hiding both come
  // back as zero rows — which is the very confusion that produced the
  // bug. A relation is readable by anon when the grant is there AND
  // either row level security is off or some permissive SELECT policy
  // admits anon. A view carries no RLS of its own, so for these two the
  // grant is the whole answer, which is the point of them.
  const readable = new Set(
    (await sql(`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'v')
        and has_table_privilege('anon', c.oid, 'select')
        and (
          not c.relrowsecurity
          or exists (
            select 1 from pg_policy p
            where p.polrelid = c.oid
              and p.polpermissive
              and p.polcmd in ('r', '*')
              and (
                p.polroles = '{0}'::oid[]
                or 'anon'::regrole::oid = any(p.polroles)
              )
          )
        )
      order by c.relname
    `)).split("\n").filter(Boolean),
  );

  check("game_spots is NOT public — it carries buyer names and emails",
    !readable.has("game_spots"));
  check("game_scoreboard IS public — the counts the site reads",
    readable.has("game_scoreboard"));
  // The board view carried a redacted buyer name. It is gone, and its
  // absence is asserted rather than assumed: a view that reappears is a
  // name that reappears.
  check("game_spot_board no longer exists at all",
    !readable.has("game_spot_board"));

  // Now prove the mechanism on real rows, because the catalogue says
  // what SHOULD happen and the whole bug was a gap between that and
  // what did.
  await sql(`
    insert into public.games (id, title, total_spots, spot_price_cents, status)
    values ('00000000-0000-4000-8000-0000000000aa', 'probe', 3, 100, 'open')
    on conflict (id) do nothing
  `);
  await sql(`
    insert into public.game_spots (game_id, spot_number, status)
    select '00000000-0000-4000-8000-0000000000aa', g, 'sold'
    from generate_series(1, 3) g
    on conflict do nothing
  `);

  const ownerSpots = Number(await sql(
    `select count(*) from public.game_spots where status = 'sold'`));
  const anonSpots = Number(
    await asAnon(`select count(*) from public.game_spots where status = 'sold'`));

  check("the sold spots genuinely exist", ownerSpots === 3, `${ownerSpots} rows`);
  check(
    "anon reading game_spots gets NOTHING, and gets it without an error",
    anonSpots === 0,
    `${anonSpots} of ${ownerSpots} rows — this is the bug's whole mechanism`,
  );
  // ------------------------------------------------------------------
  // 2. The scoreboard, which is what the public pages now read
  // ------------------------------------------------------------------
  const anonScore = await asAnon(`
    select sold || ' ' || frozen from public.game_scoreboard
    where game_id = '00000000-0000-4000-8000-0000000000aa'
  `);
  check("anon reading game_scoreboard gets the real count",
    anonScore.startsWith("3 "), anonScore || "no row");

  // The freeze. A drawn game reports what was true at the draw, so the
  // number said on camera cannot drift afterwards.
  await sql(`
    insert into public.winners (game_id, display_name, entry_total, seed, ticket)
    values ('00000000-0000-4000-8000-0000000000aa', 'Probe P.', 3, 'seed', 1)
  `);
  await sql(`
    update public.game_spots set status = 'open'
    where game_id = '00000000-0000-4000-8000-0000000000aa' and spot_number = 3
  `);
  const frozen = await asAnon(`
    select sold || ' ' || sold_now || ' ' || frozen
    from public.game_scoreboard
    where game_id = '00000000-0000-4000-8000-0000000000aa'
  `);
  // "true", not "t": psql renders a boolean cast to text in full. The
  // same detail silently dropped every NOT NULL out of the generated
  // baseline once, so it is written down rather than remembered.
  check("a drawn game keeps the count it was drawn on",
    frozen === "3 2 true", `sold/sold_now/frozen = ${frozen}`);

  // And the fallback, for the winner rows written before entry_total was
  // restored. Those have a null there, and reporting zero would be worse
  // than reporting a live recount.
  await sql(`
    update public.winners set entry_total = null
    where game_id = '00000000-0000-4000-8000-0000000000aa'
  `);
  const fallback = await asAnon(`
    select sold || ' ' || frozen from public.game_scoreboard
    where game_id = '00000000-0000-4000-8000-0000000000aa'
  `);
  check("a winner row with no recorded total falls back to a live count",
    fallback === "2 false", fallback);

  // ------------------------------------------------------------------
  // 3. Does the public query layer read anything anon cannot?
  // ------------------------------------------------------------------
  // The source check, which is the half that generalises. Every file
  // below runs with the anonymous key on public pages, so every
  // relation it names has to be one anon can actually read. A new query
  // against an authenticated-only table fails here rather than shipping
  // a zero.
  const PUBLIC_SOURCES = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) PUBLIC_SOURCES.push(p);
    }
  })(join(ROOT, "lib"));
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) PUBLIC_SOURCES.push(p);
    }
  })(join(ROOT, "app", "(site)"));

  const offenders = [];
  for (const file of PUBLIC_SOURCES) {
    const src = readFileSync(file, "utf8");
    // `getSupabase()` is the anonymous client; `getSessionSupabase()` is
    // the signed-in one. Only files using the anonymous one are in
    // scope — an admin page reading game_spots is correct.
    if (!/\bgetSupabase\s*\(/.test(src)) continue;
    if (/\bgetSessionSupabase\s*\(/.test(src)) {
      note(`${file.replace(ROOT + "/", "")} uses both clients — not checked automatically`);
      continue;
    }
    for (const m of src.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]/g)) {
      const rel = m[1];
      if (!relations.includes(rel)) continue; // not a table we know
      if (!readable.has(rel)) {
        offenders.push(`${file.replace(ROOT + "/", "")} reads ${rel}`);
      }
    }
  }

  check(
    "no public page reads a relation the anonymous role cannot see",
    offenders.length === 0,
    offenders.join("; ") || `checked ${PUBLIC_SOURCES.length} files`,
  );
  note(`anon can read: ${[...readable].sort().join(", ")}`);
} finally {
  await scratch.drop();
}

report();
