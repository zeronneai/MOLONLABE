// Two buyers, one last spot, at the same instant.
//
// This runs against REAL PostgreSQL with the REAL migration applied, and
// it has to: the local test double is single-threaded JavaScript, so it
// serialises every request and would pass this whether or not the SQL is
// correct. A concurrency test that cannot fail proves nothing.
//
// Contention is made genuine rather than hoped for. Each worker opens its
// own connection, and they are released together by a barrier, so the
// claims land inside the same few milliseconds rather than one after
// another.

import { spawn } from "node:child_process";

// Its own database, created from the template and dropped at the end.
// These tests used to share one, which made the result depend on run
// order — the draw race left winner rows this test's cleanup tripped on.
import { scratchDatabase } from "../lib/pg.mjs";
import { PG } from "../lib/config.mjs";
const scratch = await scratchDatabase("spotrace");
const PSQL = ["-h", PG.host, "-p", PG.port, "-U", PG.user, "-d", scratch.name, "-t", "-A"];

const ok = [], bad = [];
const check = (l, p, d = "") =>
  (p ? ok : bad).push(`${p ? "PASS" : "FAIL"} ${l}${d ? ` — ${d}` : ""}`);

function sql(text) {
  return new Promise((resolve, reject) => {
    const p = spawn("psql", [...PSQL, "-c", text]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0
        // psql -t -A still prints command tags for INSERT/UPDATE; keep
        // only the first line, which is the value we asked for.
        ? resolve(out.trim().split("\n")[0].trim())
        : reject(new Error(err.trim())),
    );
  });
}

/** Every row, joined — for the queries that genuinely return a set. */
function sqlAll(text) {
  return new Promise((resolve, reject) => {
    const p = spawn("psql", [...PSQL, "-c", text]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0
        ? resolve(out.trim().split("\n").map((l) => l.trim()).filter(Boolean).join(" "))
        : reject(new Error(err.trim())),
    );
  });
}

async function makeGame(spots) {
  await sql("delete from game_spots; delete from games;");
  const id = await sql(
    `insert into games (title, status, total_spots, spot_price_cents)
     values ('Race', 'open', ${spots}, 3000) returning id;`,
  );
  await sql(
    `insert into game_spots (game_id, spot_number)
     select '${id}', generate_series(1, ${spots});`,
  );
  return id;
}

/**
 * N claims released at the same instant.
 *
 * The barrier is a SHARED advisory lock, not an exclusive one. That
 * distinction is the whole test: an exclusive lock would make the workers
 * queue behind each other, which is a sequential test wearing a
 * concurrency test's clothes and would pass against almost any
 * implementation. Shared locks are compatible with one another, so when
 * the gate's exclusive hold drops, all N acquire together and hit
 * claim_game_spots inside the same few milliseconds.
 *
 * Each worker is its own psql process, so each has its own backend and
 * its own transaction. Nothing here shares a connection.
 */
async function stampede(gameId, workers, qtyEach) {
  const gate = spawn("psql", [
    ...PSQL,
    "-c",
    "select pg_advisory_lock(1); select pg_sleep(3);",
  ]);
  await new Promise((r) => setTimeout(r, 500));

  const runs = Array.from({ length: workers }, (_, i) =>
    new Promise((resolve) => {
      // One row out, so there is nothing to mis-parse: the shared lock is
      // taken in a subquery and the claim is the only thing selected.
      const p = spawn("psql", [
        ...PSQL,
        "-c",
        `select coalesce(array_to_string(claim_game_spots('${gameId}', ${qtyEach}), ','), 'REFUSED')
         from (select pg_advisory_lock_shared(1)) gate;`,
      ]);
      let out = "", err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("close", (code) =>
        resolve({
          worker: i,
          result: code === 0 ? out.trim().split("\n")[0].trim() : `ERROR ${err.trim().slice(0, 60)}`,
        }),
      );
    }),
  );

  // Everything is now blocked on the gate. Dropping it releases them
  // together.
  await new Promise((r) => setTimeout(r, 800));
  gate.kill("SIGINT");
  return Promise.all(runs);
}

// ------------------------------------------- one spot, ten buyers
{
  const game = await makeGame(1);
  const results = await stampede(game, 10, 1);
  const winners = results.filter((r) => r.result !== "REFUSED" && r.result !== "ERROR");
  const refused = results.filter((r) => r.result === "REFUSED");

  check("exactly one of ten simultaneous buyers got the last spot",
    winners.length === 1, `${winners.length} won, ${refused.length} refused`);
  check("the other nine were refused outright",
    refused.length === 9, `${refused.length}`);

  const held = await sql(
    `select count(*) from game_spots where game_id='${game}' and status='held';`,
  );
  check("exactly one spot is held", held === "1", held);

  const open = await sql(
    `select count(*) from game_spots where game_id='${game}' and status='open';`,
  );
  check("no spot was left open after being taken", open === "0", open);
}

// ------------------------- five spots, ten buyers wanting two each
{
  const game = await makeGame(5);
  const results = await stampede(game, 10, 2);
  const winners = results.filter((r) => r.result !== "REFUSED" && r.result !== "ERROR");

  const claimed = winners.flatMap((w) => w.result.split(",").map(Number));
  const unique = new Set(claimed);

  check("no spot was handed to two buyers",
    claimed.length === unique.size,
    `${claimed.length} claimed, ${unique.size} distinct`);
  check("never more spots than the game has",
    claimed.length <= 5, `${claimed.length} of 5`);
  // HOW MANY buyers win is not a property of the code, it is a property
  // of the scheduler. `claim_game_spots` uses FOR UPDATE SKIP LOCKED, so
  // a buyer who cannot find two UNLOCKED rows refuses outright even
  // though two are free a millisecond later — that is the correct
  // trade, chosen so a spot is never sold twice. One winner and two are
  // both right.
  //
  // This used to assert exactly two winners, and passed for weeks on
  // timing alone before producing one. A timing-dependent assertion is
  // the same disease as an order-dependent one: it will eventually call
  // correct behaviour a failure, and the next person will "fix" working
  // code to satisfy it.
  check("at least one buyer got through — the claim is not deadlocking",
    winners.length >= 1, `${winners.length} winners`);
  check("every winner got the full pair, never a partial claim",
    winners.every((w) => w.result.split(",").length === 2),
    winners.map((w) => w.result.split(",").length).join(", ") || "none");

  // The invariant that does hold whatever the scheduler does: every spot
  // is either claimed or still open. None may be lost in between.
  const open = await sql(
    `select count(*) from game_spots where game_id='${game}' and status='open';`,
  );
  check("every spot is accounted for — claimed or open, never half-claimed",
    claimed.length + Number(open) === 5,
    `${claimed.length} claimed + ${open} open`);
  check("the spots left over are an odd number out of pairs",
    Number(open) % 2 === 1, `${open} open`);
}

// ------------------------------- a refused claim leaks nothing
{
  const game = await makeGame(3);
  await sql(`select claim_game_spots('${game}', 3);`);
  const refused = await sql(`select coalesce(array_to_string(claim_game_spots('${game}', 1), ','), 'REFUSED');`);
  check("a claim against a full game is refused", refused === "REFUSED", refused);
  const held = await sql(
    `select count(*) from game_spots where game_id='${game}' and status='held';`,
  );
  check("the refused claim held nothing extra", held === "3", held);
}

// --------------------------------- releasing puts them back
{
  const game = await makeGame(4);
  const got = await sql(`select array_to_string(claim_game_spots('${game}', 4), ',');`);
  await sql(`select release_game_spots('${game}', array[${got}]);`);
  const open = await sql(
    `select count(*) from game_spots where game_id='${game}' and status='open';`,
  );
  check("a failed charge returns every spot", open === "4", open);
  check("and the numbers are the same ones, not new ones",
    (await sql(`select string_agg(spot_number::text, ',' order by spot_number) from game_spots where game_id='${game}' and status='open';`)) === "1,2,3,4");
}

// ------------------------- selling the last spot closes the game
{
  const game = await makeGame(2);
  const order = await sql(
    // Every not-null column has to be satisfied. An earlier version
    // inserted only the order number and passed, because the database it
    // ran against had not been built from the full migration chain —
    // which is the same class of drift this whole exercise is about.
    `insert into orders (order_number, email, first_name, last_name,
       subtotal_cents, tax_cents, shipping_cents, total_cents,
       disclaimer_accepted_at, disclaimer_text, refund_policy_text,
       confirmation_token)
     values ('MLF-' || substr(md5(random()::text),1,6), 'race@example.com',
       'Race', 'Tester', 3000, 248, 0, 3248, now(), 'x', 'x',
       md5(random()::text) || md5(random()::text))
     returning id;`,
  );
  await sql(`select claim_game_spots('${game}', 1);`);
  await sql(`select sell_game_spots('${game}', array[1], '${order}', 'Dana','Ruiz','d@e.com',null);`);
  check("one of two sold leaves the game open",
    (await sql(`select status from games where id='${game}';`)) === "open");

  await sql(`select claim_game_spots('${game}', 1);`);
  await sql(`select sell_game_spots('${game}', array[2], '${order}', 'Alma','Cortez','a@e.com',null);`);
  check("selling the last spot closes the game",
    (await sql(`select status from games where id='${game}';`)) === "full");

  // The board and its display_name view are gone. What still has to be
  // true is that both spots sold to the right buyers and that no name
  // is reachable through anything public.
  const owners = await sqlAll(
    `select spot_number || '=' || coalesce(first_name, 'null')
     from game_spots where game_id='${game}' order by spot_number;`,
  );
  check("both spots sold, each to its own buyer",
    owners === "1=Dana 2=Alma", owners);
  const boardGone = await sql(
    `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relname='game_spot_board';`,
  );
  check("the name-bearing board view no longer exists", boardGone === "0", boardGone);
}

// ------------------------- a stale hold is reclaimed, not lost
{
  const game = await makeGame(1);
  await sql(`select claim_game_spots('${game}', 1);`);
  const blocked = await sql(`select coalesce(array_to_string(claim_game_spots('${game}', 1), ','), 'REFUSED');`);
  check("a fresh hold blocks the next buyer", blocked === "REFUSED", blocked);

  await sql(`update game_spots set held_at = now() - interval '20 minutes' where game_id='${game}';`);
  const recovered = await sql(`select coalesce(array_to_string(claim_game_spots('${game}', 1), ','), 'REFUSED');`);
  check("an abandoned checkout does not take a spot out of circulation forever",
    recovered === "1", recovered);
}

for (const l of ok) console.log(l);
for (const l of bad) console.log(l);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await scratch.drop();
process.exit(bad.length === 0 ? 0 : 1);
