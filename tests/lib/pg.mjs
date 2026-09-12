// Real PostgreSQL, for the tests the double cannot honestly run.
//
// The double is single-threaded JavaScript. It serialises every request,
// so a concurrency test against it would pass whether or not the SQL is
// correct — a test that cannot fail proves nothing.
//
// EVERY TEST GETS ITS OWN DATABASE. Two of these used to share one, and
// the first left rows the second tripped over, so the suite's result
// depended on the order it ran in. An order-dependent suite is one that
// will eventually report something untrue, and it will do it on the day
// somebody adds a test in the middle.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { PG } from "./config.mjs";

const run = promisify(execFile);
const base = ["-h", PG.host, "-p", PG.port, "-U", PG.user];

/** Runs SQL against `db` and returns stdout. Throws on error. */
export async function sql(db, text) {
  const { stdout } = await run("psql", [...base, "-d", db, "-t", "-A", "-c", text], {
    maxBuffer: 64 << 20,
  });
  return stdout.trim();
}

/** Same, but resolves with stderr instead of throwing — for expected failures. */
export function trySql(db, text) {
  return new Promise((resolve) => {
    const p = spawn("psql", [...base, "-d", db, "-t", "-A", "-c", text]);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

/**
 * A fresh database cloned from the template, and a function to drop it.
 *
 * Cloning rather than re-running the migrations keeps each test to about
 * a second instead of about a minute, which is the difference between a
 * check that gets run and one that does not.
 */
export async function scratchDatabase(label = "test") {
  const name = `mlf_${label}_${randomBytes(4).toString("hex")}`.slice(0, 60);
  await run("psql", [...base, "-d", "postgres", "-c",
    `create database ${name} template ${PG.template}`]);

  let dropped = false;
  const drop = async () => {
    if (dropped) return;
    dropped = true;
    // Terminate stragglers first: a worker still holding a connection
    // makes DROP DATABASE fail, and a leaked database makes the NEXT run
    // of this test collide.
    await run("psql", [...base, "-d", "postgres", "-c",
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}'`,
    ]).catch(() => {});
    await run("psql", [...base, "-d", "postgres", "-c",
      `drop database if exists ${name}`]).catch(() => {});
  };
  // No exit hook: Node's exit handlers cannot await, so one here would
  // only look like cleanup. A suite that dies before its finally block
  // leaves its database behind, and `sweepScratchDatabases` — which the
  // runner calls before each db run — is what actually collects them.
  return { name, drop, sql: (t) => sql(name, t), trySql: (t) => trySql(name, t) };
}

/**
 * Runs `work` against N connections released at the same instant.
 *
 * The barrier is a SHARED advisory lock held exclusively by a gate
 * process. That detail is the whole test: with the EXCLUSIVE form the
 * workers queue and it becomes a sequential test wearing a concurrency
 * test's clothes, which passes against almost any implementation.
 */
export async function simultaneously(db, count, statement, lockId = 918273) {
  const gate = spawn("psql", [...base, "-d", db, "-c",
    `select pg_advisory_lock(${lockId}); select pg_sleep(4);`]);
  await new Promise((r) => setTimeout(r, 700));

  const workers = Array.from({ length: count }, () =>
    trySql(db, `select pg_advisory_lock_shared(${lockId}); ${statement}`),
  );
  const results = await Promise.all(workers);
  gate.kill();
  return results.map((r) => ({
    ...r,
    // The last non-empty line is the statement's own result; everything
    // before it is the lock acquisition.
    value: r.out.split("\n").map((s) => s.trim()).filter(Boolean).pop() ?? "",
  }));
}

/**
 * Drops scratch databases left behind by a suite that died mid-run.
 *
 * Called by the runner before the db suites, not after, so that a
 * leftover can still be inspected while debugging and is cleared on the
 * next run rather than immediately.
 */
export async function sweepScratchDatabases() {
  const { stdout } = await run("psql", [...base, "-d", "postgres", "-t", "-A", "-c",
    "select datname from pg_database where datname ~ '^mlf_[a-z]+_[0-9a-f]{8}$'"]);
  const stale = stdout.trim().split("\n").filter(Boolean);
  for (const name of stale) {
    await run("psql", [...base, "-d", "postgres", "-c",
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${name}'`,
    ]).catch(() => {});
    await run("psql", [...base, "-d", "postgres", "-c", `drop database if exists ${name}`])
      .catch(() => {});
  }
  return stale.length;
}
