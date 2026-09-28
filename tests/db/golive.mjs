// The go-live cleanup, run for real against PostgreSQL.
//
// supabase/repair/go-live/ is pasted into the SQL editor on launch day,
// against the only copy of the client's data, once. It must remove every
// sandbox order and return the guides they held, and it must not touch
// his items, his stock, or anything about a drop he has set up. This
// builds a database that looks like his on the day and runs the three
// files exactly as written, with only the values he fills in replaced.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { suite } from "../lib/harness.mjs";
import { scratchDatabase } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";

const { check, report } = suite();
const ROOT = join(import.meta.dirname, "..", "..");
const DIR = join(ROOT, "supabase/repair/go-live");
const run = promisify(execFile);
const TMP = mkdtempSync(join(tmpdir(), "golive-"));

const read = (f) => readFileSync(join(DIR, f), "utf8");
const CUTOFF = "2026-09-27 14:00:00-06";

/** Runs a script file as the SQL editor would: whole, stopping at an error. */
async function script(target, text) {
  const db = typeof target === "string" ? target : target.name;
  const file = join(TMP, `${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(file, text);
  try {
    const { stdout } = await run("psql", [
      "-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", db,
      "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "|", "-f", file,
    ], { maxBuffer: 16 << 20 });
    return { ok: true, out: stdout.trim(), err: "" };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? "").trim(), err: String(e.stderr ?? e.message) };
  }
}
const preview = (db) => script(db, read("1-preview.sql").replace("PUT-THE-CUTOFF-HERE", CUTOFF));
const cleanup = (db, { cutoff = CUTOFF, expected } = {}) => {
  let text = read("2-cleanup.sql");
  if (cutoff !== null) text = text.replace("v_cutoff   timestamptz := null;", `v_cutoff   timestamptz := '${cutoff}';`);
  if (expected !== undefined) text = text.replace("v_expected integer     := null;", `v_expected integer     := ${expected};`);
  return script(db, text);
};

const HALLOWEEN = "a0000000-0000-4000-8000-000000000001";
const TESTFULL = "a0000000-0000-4000-8000-000000000002";
const DEMO = "a0000000-0000-4000-8000-000000000003";
const PRIZE = "b0000000-0000-4000-8000-000000000001";
const TEE = "b0000000-0000-4000-8000-000000000002";
const TEE_M = "c0000000-0000-4000-8000-000000000001";
const O1 = "d0000000-0000-4000-8000-000000000001"; // sandbox, Halloween 1-2
const O2 = "d0000000-0000-4000-8000-000000000002"; // sandbox, fills the test drop
const O3 = "d0000000-0000-4000-8000-000000000003"; // sandbox, a tee
const REAL = "d0000000-0000-4000-8000-000000000009"; // after the cutoff
const INSTORE = "d0000000-0000-4000-8000-000000000008"; // at the counter, before the cutoff

async function build(db) {
  await db.sql(`
    insert into public.items (id, slug, name, category, price_cents, fulfillment_type, status, has_variants)
    values ('${PRIZE}', 'halloween-rifle', 'Halloween Rifle', 'rifle', null, 'pickup', 'available', false),
           ('${TEE}', 'tee', 'Tee', 'apparel', 3000, 'ship', 'available', true);
    insert into public.item_variants (id, item_id, size, stock) values ('${TEE_M}', '${TEE}', 'M', 7);

    insert into public.games (id, title, description, item_id, total_spots, spot_price_cents, status,
                              guide_why, guide_care, guide_pairs, updated_by_name)
    values ('${HALLOWEEN}', 'Halloween Drop', 'The client''s words.', '${PRIZE}', 10, 2500, 'open',
            'why text', 'care text', 'pairs text', 'Rey Marquez'),
           ('${TESTFULL}', 'Test Drop', null, null, 3, 1000, 'full', null, null, null, 'Rey Marquez'),
           ('${DEMO}', '[DEMO] Example', null, null, 3, 1000, 'drawn', null, null, null, 'Rey Marquez');
    insert into public.game_spots (game_id, spot_number, status)
      select '${HALLOWEEN}', n, 'open' from generate_series(1, 10) n;
    insert into public.game_spots (game_id, spot_number, status)
      select '${TESTFULL}', n, 'open' from generate_series(1, 3) n;
    insert into public.game_spots (game_id, spot_number, status, first_name, last_name, email, sold_at)
      select '${DEMO}', n, 'sold', 'Demo', 'Buyer', 'demo@example.invalid', now() from generate_series(1, 3) n;
    insert into public.winners (game_id, spot_id, display_name, seed, ticket, ticket_index, entry_total)
      select '${DEMO}', id, 'Demo B.', 'seed', 1, 0, 3 from public.game_spots
      where game_id = '${DEMO}' and spot_number = 1;
  `);
  const order = (id, number, at) => `
    insert into public.orders (id, order_number, email, first_name, last_name, subtotal_cents, total_cents,
                               disclaimer_accepted_at, disclaimer_text, refund_policy_text, confirmation_token, created_at)
    values ('${id}', '${number}', 'buyer@example.com', 'Dana', 'Ruiz', 2500, 2706, now(), 'x', 'x', 't-${number}', '${at}');`;
  await db.sql(
    order(O1, "MLF-S1", "2026-09-20 10:00:00-06") +
    order(O2, "MLF-S2", "2026-09-21 10:00:00-06") +
    order(O3, "MLF-S3", "2026-09-22 10:00:00-06") +
    order(REAL, "MLF-R1", "2026-09-27 15:00:00-06") + `
    update public.game_spots set status = 'sold', order_id = '${O1}', first_name = 'Dana', last_name = 'Ruiz',
      email = 'dana@example.com', phone = '9155550100', sold_at = now()
      where game_id = '${HALLOWEEN}' and spot_number in (1, 2);
    update public.game_spots set status = 'sold', order_id = '${O2}', first_name = 'Test', last_name = 'Er',
      email = 'test@example.com', sold_at = now()
      where game_id = '${TESTFULL}';
    update public.game_spots set status = 'sold', order_id = '${REAL}', first_name = 'Real', last_name = 'Buyer',
      email = 'real@example.com', sold_at = now()
      where game_id = '${HALLOWEEN}' and spot_number = 3;
    -- A sold guide with no order (hand-made test data), an abandoned hold,
    -- and a checkout happening right now.
    update public.game_spots set status = 'sold', first_name = 'Hand', last_name = 'Made', sold_at = now()
      where game_id = '${HALLOWEEN}' and spot_number = 4;
    update public.game_spots set status = 'held', held_at = now() - interval '1 hour'
      where game_id = '${HALLOWEEN}' and spot_number = 5;
    update public.game_spots set status = 'held', held_at = now()
      where game_id = '${HALLOWEEN}' and spot_number = 6;
    -- A real sale at the counter, recorded BEFORE the cutoff. Never a test.
    insert into public.orders (id, order_number, source, email, first_name, last_name, phone, subtotal_cents, total_cents,
                               gateway, game_id, game_terms_accepted_at, game_terms_text, recorded_by_name,
                               confirmation_token, created_at)
    values ('${INSTORE}', 'MLF-S-COUNTER', 'in_store', null, 'Counter', 'Buyer', '9155550111', 2500, 2500,
            'in_store', '${HALLOWEEN}', now(), 'The buyer was shown the rules and agreed.', 'Luis Ortega',
            't-counter', '2026-09-25 10:00:00-06');
    update public.game_spots set status = 'sold', order_id = '${INSTORE}', first_name = 'Counter', last_name = 'Buyer',
      phone = '9155550111', sold_at = now()
      where game_id = '${HALLOWEEN}' and spot_number = 7;
    insert into public.order_items (order_id, line_type, item_id, variant_id, name, quantity, unit_price_cents, line_total_cents, fulfillment_type)
      values ('${O3}', 'inventory', '${TEE}', '${TEE_M}', 'Tee', 2, 3000, 6000, 'ship');
    insert into public.order_items (order_id, line_type, game_id, name, quantity, unit_price_cents, line_total_cents, fulfillment_type, spot_numbers)
      values ('${O1}', 'game_spot', '${HALLOWEEN}', 'Halloween Drop: guide numbers 1, 2', 2, 2500, 5000, 'none', '{1,2}');
  `);
}

/** Everything the cleanup must leave exactly as it was. */
const untouched = (db) => db.sql(`
  select json_build_object(
    'games', (select json_agg(json_build_object('id', id, 'title', title, 'description', description,
               'item_id', item_id, 'total', total_spots, 'price', spot_price_cents, 'why', guide_why,
               'care', guide_care, 'pairs', guide_pairs, 'by', updated_by_name) order by id) from public.games),
    'items', (select json_agg(row_to_json(i) order by id) from public.items i),
    'variants', (select json_agg(row_to_json(v) order by id) from public.item_variants v),
    'winners', (select json_agg(row_to_json(w) order by id) from public.winners w),
    'real', (select row_to_json(o) from public.orders o where id = '${REAL}'),
    'instore', (select row_to_json(o) from public.orders o where id = '${INSTORE}')
  )::text`);
const snapshot = (db) => db.sql(`
  select json_build_object(
    'orders', (select count(*) from public.orders),
    'spots', (select json_agg(json_build_object('g', game_id, 'n', spot_number, 's', status, 'o', order_id) order by game_id, spot_number) from public.game_spots),
    'games', (select json_agg(status order by id) from public.games))::text`);

const db = await scratchDatabase("golive");
try {
  await build(db);
  const keep = await untouched(db);
  const before = await snapshot(db);

  // ------------------------------------------------------------ preview
  const p = await preview(db);
  const rows = p.out.split("\n").map((l) => l.split("|"));
  const row = (what, detail) => rows.find((r) => r[1] === what && (!detail || r[2].includes(detail)));
  check("PREVIEW runs", p.ok, p.err.split("\n")[0]);
  check("PREVIEW counts three sandbox orders to delete", row("orders to delete")?.[3] === "3",
    row("orders to delete")?.join(" | "));
  check("PREVIEW counts the real order and the in-store sale as kept", row("orders kept")?.[3] === "2",
  row("orders kept")?.join(" | "));
  check("PREVIEW lists the test guides per drop",
    row("guides to return", "Halloween Drop (open)")?.[3] === "2" && row("guides to return", "Test Drop (full)")?.[3] === "3",
    rows.filter((r) => r[1] === "guides to return").map((r) => r.slice(2).join(" ")).join("; "));
  check("PREVIEW lists the orderless guide and the abandoned hold, not the live one",
    row("guides to return", "no order")?.[3] === "1" && row("guides to return", "abandoned")?.[3] === "1");
  check("PREVIEW lists the stock test orders took, as not restored",
    row("stock the test orders took (NOT restored)", "Tee / M")?.[3] === "2");
  check("PREVIEW has no STOP row", !rows.some((r) => r[1]?.startsWith("STOP")));
  check("PREVIEW changed nothing", (await snapshot(db)) === before);

  // ----------------------------------------------------- the refusals
  const blank = await cleanup(db, { cutoff: null });
  check("CLEANUP with nothing filled in refuses", !blank.ok && /Fill in the cutoff/.test(blank.err),
    blank.err.split("\n")[0]);
  const wrong = await cleanup(db, { expected: 4 });
  check("CLEANUP with the wrong order count refuses", !wrong.ok && /3 orders before the cutoff, not the 4/.test(wrong.err),
    wrong.err.split("\n")[0]);
  check("and neither changed anything", (await snapshot(db)) === before);

  // ---------------------------------------------------------- cleanup
  const done = await cleanup(db, { expected: 3 });
  check("CLEANUP runs", done.ok, done.err.split("\n")[0]);
  const got = Object.fromEntries(done.out.split("\n").map((l) => l.split("|")));
  check("CLEANUP reports what it did",
    got["sandbox orders deleted, with their lines"] === "3" &&
      got["guides returned from test orders"] === "5" &&
      got["guides returned that had no order"] === "2" &&
      got["drops reopened (were full of test guides)"] === "1",
    done.out.replace(/\n/g, "; "));

  const spot = (g, n) => db.sql(`select status || ' ' || coalesce(order_id::text, '-') || ' ' ||
    coalesce(email, '-') || ' ' || coalesce(sold_at::text, '-') from public.game_spots where game_id = '${g}' and spot_number = ${n}`);
  check("Halloween guides 1 and 2 are available again, with no buyer on them",
    (await spot(HALLOWEEN, 1)) === "open - - -" && (await spot(HALLOWEEN, 2)) === "open - - -",
    `${await spot(HALLOWEEN, 1)} / ${await spot(HALLOWEEN, 2)}`);
  check("the real buyer's guide 3 is still theirs", (await spot(HALLOWEEN, 3)).startsWith(`sold ${REAL} real@example.com`));
  check("the orderless guide and the abandoned hold are available",
    (await spot(HALLOWEEN, 4)).startsWith("open") && (await spot(HALLOWEEN, 5)).startsWith("open"));
  check("a checkout in progress right now keeps its hold", (await spot(HALLOWEEN, 6)).startsWith("held"));
  check("the drop filled by test orders is open again with all its guides",
    (await db.sql(`select status || ' ' || (select count(*) from public.game_spots where game_id = '${TESTFULL}' and status = 'open') from public.games where id = '${TESTFULL}'`)) === "open 3");
  check("the drawn demo drop is untouched",
    (await db.sql(`select status || ' ' || (select count(*) from public.game_spots where game_id = '${DEMO}' and status = 'sold') from public.games where id = '${DEMO}'`)) === "drawn 3");
  check("only the real order and the in-store sale remain",
    (await db.sql(`select string_agg(order_number, ',' order by order_number) from public.orders`)) === "MLF-R1,MLF-S-COUNTER" &&
      (await db.sql(`select count(*) from public.order_items`)) === "0");
  check("the in-store buyer still holds guide 7, recorded before the cutoff",
    (await spot(HALLOWEEN, 7)).startsWith(`sold ${INSTORE}`), await spot(HALLOWEEN, 7));
  check("every drop's settings, the items, the stock, the winners and the real order are exactly as they were",
    (await untouched(db)) === keep);

  // ----------------------------------------------------------- verify
  const v = await script(db, read("3-verify.sql"));
  const vrows = v.out.split("\n").map((l) => l.split("|"));
  const failing = vrows.filter((r) => r[2] === "FAIL");
  check("VERIFY runs and every check passes", v.ok && failing.length === 0 && vrows.filter((r) => r[2] === "PASS").length === 6,
    failing.map((r) => `${r[1]}: ${r[3]}`).join("; ") || v.err.split("\n")[0]);
  check("VERIFY lists each drop's numbers",
    vrows.some((r) => r[1] === "drop: Halloween Drop" && r[3] === "open, 10 guides at $25.00: 2 sold, 1 held, 7 available"),
    vrows.filter((r) => r[1]?.startsWith("drop:")).map((r) => `${r[1]} ${r[3]}`).join("; "));

  // ------------------------------------ run twice: the second does nothing
  const again = await cleanup(db, { expected: 0 });
  check("running it again finds nothing to do", again.ok && /sandbox orders deleted, with their lines\|0/.test(again.out),
    again.out.replace(/\n/g, "; ") || again.err.split("\n")[0]);
} finally {
  await db.drop();
}

// --------------------------- a drop drawn with test guides: refuse, change nothing
const db2 = await scratchDatabase("golive2");
try {
  await build(db2);
  await db2.sql(`
    update public.game_spots set status = 'sold', order_id = '${O1}', sold_at = now()
      where game_id = '${HALLOWEEN}' and status <> 'sold';
    update public.game_spots set status = 'sold', order_id = '${O1}' where game_id = '${HALLOWEEN}' and order_id is null;
    insert into public.winners (game_id, spot_id, display_name, seed, ticket, ticket_index, entry_total)
      select '${HALLOWEEN}', id, 'Dana R.', 'seed', 1, 0, 10 from public.game_spots
      where game_id = '${HALLOWEEN}' and spot_number = 1;
  `);
  const before = await snapshot(db2);
  const p = await preview(db2);
  check("PREVIEW shows a STOP row for a drop drawn with test guides",
    p.out.split("\n").some((l) => l.startsWith("6|STOP") && l.includes("Halloween Drop")));
  const r = await cleanup(db2, { expected: 3 });
  check("CLEANUP refuses a drop drawn with test guides, and names it",
    !r.ok && /drawn with test guides in them: Halloween Drop/.test(r.err), r.err.split("\n")[0]);
  check("and changed nothing", (await snapshot(db2)) === before);
} finally {
  await db2.drop();
}

report();
