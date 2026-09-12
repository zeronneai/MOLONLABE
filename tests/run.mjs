#!/usr/bin/env node
// The test runner.
//
//   npm test                 everything
//   npm test -- spots draw   only suites whose name matches
//   npm test -- --db         only the PostgreSQL suites
//   npm test -- --list       what exists, without running it
//
// It starts what the tests need, runs them, and stops what it started.
// Anything already listening on the configured ports is reused and left
// running, so an app you are already debugging is not killed underneath
// you.
//
// Exit code is the number of failing suites, capped at 125.

import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { APP, APP_PORT, DOUBLE, DOUBLE_PORT, PG, ROOT } from "./lib/config.mjs";
import { sweepScratchDatabases } from "./lib/pg.mjs";

const run = promisify(execFile);
const HERE = join(ROOT, "tests");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const filters = args.filter((a) => !a.startsWith("-"));

const listing = (dir) =>
  existsSync(join(HERE, dir))
    ? readdirSync(join(HERE, dir)).filter((f) => f.endsWith(".mjs")).sort()
      .map((f) => ({ kind: dir, name: f.replace(/\.mjs$/, ""), path: join(HERE, dir, f) }))
    : [];

// Inspection scripts print findings but have no pass/fail line, so the
// runner cannot judge them and does not try. They are listed, and run
// only when named explicitly.
const INSPECTION = new Set(["mixed", "leak", "inbox", "friction", "closed", "urgent"]);

let suites = [...listing("browser"), ...listing("db")]
  .map((s) => ({ ...s, inspection: INSPECTION.has(s.name) }));

if (flag("--db")) suites = suites.filter((s) => s.kind === "db");
if (flag("--browser")) suites = suites.filter((s) => s.kind === "browser");
if (filters.length) {
  suites = suites.filter((s) => filters.some((f) => s.name.includes(f)));
} else {
  suites = suites.filter((s) => !s.inspection);
}

if (flag("--list")) {
  for (const s of [...listing("browser"), ...listing("db")]) {
    console.log(
      `${s.kind.padEnd(8)} ${s.name.padEnd(16)} ${INSPECTION.has(s.name) ? "(inspection — run by name)" : ""}`,
    );
  }
  process.exit(0);
}
if (!suites.length) {
  console.error("No suites matched. Try --list.");
  process.exit(1);
}

// Services this run started, as process-group leaders.
//
// Two things here are deliberate and were both learned by the runner
// hanging after it had finished.
//
// `detached: true` puts each service in its own process group, because
// `npx next start` spawns a grandchild that survives a SIGTERM sent to
// npx alone — killing the group gets both.
//
// Stderr is NOT inherited. A service that inherits the runner's stderr
// holds that pipe open, so `npm test | tail` never sees EOF and hangs
// forever after the last suite has reported. Their output goes to a
// buffer instead and is printed only if they fail to come up.
const started = [];

function stopServices() {
  for (const { proc } of started) {
    try { process.kill(-proc.pid, "SIGTERM"); } catch { /* already gone */ }
  }
  started.length = 0;
}
const listening = async (url) => {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
};
const waitFor = async (url, what, seconds = 60) => {
  for (let i = 0; i < seconds * 2; i++) {
    if (await listening(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} never came up at ${url}`);
};

async function startDouble() {
  if (await listening(`${DOUBLE}/__dump`)) {
    console.log(`· reusing the double already on ${DOUBLE_PORT}`);
    return;
  }
  const proc = spawn("node", [join(HERE, "fixtures", "double.mjs"), String(DOUBLE_PORT)], {
    stdio: ["ignore", "ignore", "pipe"],
    detached: true,
  });
  let err = "";
  proc.stderr.on("data", (d) => (err += d));
  started.push({ proc, name: "the double" });
  await waitFor(`${DOUBLE}/__dump`, "the double", 20).catch((e) => {
    if (err) console.error(err.split("\n").slice(-10).join("\n"));
    throw e;
  });
  console.log(`· started the double on ${DOUBLE_PORT}`);
}

async function startApp() {
  if (await listening(APP)) {
    console.log(`· reusing the app already on ${APP_PORT}`);
    return;
  }
  if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) {
    console.log("· building (no .next found)");
    await run("npm", ["run", "build"], { cwd: ROOT, maxBuffer: 64 << 20 });
  }
  const proc = spawn("npx", ["next", "start", "-p", String(APP_PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "pipe"],
    detached: true,
  });
  let err = "";
  proc.stderr.on("data", (d) => (err += d));
  started.push({ proc, name: "the app" });
  await waitFor(APP, "the app", 90).catch((e) => {
    if (err) console.error(err.split("\n").slice(-10).join("\n"));
    throw e;
  });
  console.log(`· started the app on ${APP_PORT}`);
}

/**
 * Builds the template database the db suites clone.
 *
 * Built once and cloned per test, because applying fourteen migrations
 * takes about a minute and cloning takes about a second — and a check
 * that costs a minute per test is a check that stops being run.
 */
async function prepareTemplate() {
  const psql = ["-h", PG.host, "-p", PG.port, "-U", PG.user];
  const migrations = join(ROOT, "supabase", "migrations");
  const files = readdirSync(migrations).filter((x) => x.endsWith(".sql")).sort();

  // A fingerprint of every migration, stored inside the template.
  //
  // Reusing the template is what makes the db suites fast, and it is also
  // how they would quietly start testing an old schema: add a migration,
  // and every run afterwards clones a database that predates it. The
  // suite would stay green while proving nothing about the change just
  // made. So the template carries a hash of the chain that built it, and
  // is rebuilt when that no longer matches.
  const fingerprint = createHash("sha256");
  for (const f of files) {
    fingerprint.update(f);
    fingerprint.update(readFileSync(join(migrations, f)));
  }
  const want = fingerprint.digest("hex").slice(0, 16);

  const exists = await run("psql", [...psql, "-d", "postgres", "-t", "-A", "-c",
    `select 1 from pg_database where datname = '${PG.template}'`]);
  if (exists.stdout.trim() === "1") {
    const have = await run("psql", [...psql, "-d", PG.template, "-t", "-A", "-c",
      "select fingerprint from public._test_template_fingerprint limit 1",
    ]).then((r) => r.stdout.trim()).catch(() => "");
    if (have === want) {
      console.log(`· reusing the template database ${PG.template}`);
      return;
    }
    console.log(
      have
        ? `· migrations changed since the template was built — rebuilding`
        : `· template has no fingerprint — rebuilding`,
    );
    await run("psql", [...psql, "-d", "postgres", "-c",
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${PG.template}'`,
    ]).catch(() => {});
    await run("psql", [...psql, "-d", "postgres", "-c", `drop database ${PG.template}`]);
  }
  console.log(`· building the template database ${PG.template} (${files.length} migrations)`);
  await run("psql", [...psql, "-d", "postgres", "-c", `create database ${PG.template}`]);
  const stub = join(HERE, "fixtures", "platform-stub.sql");
  if (existsSync(stub)) {
    await run("psql", [...psql, "-d", PG.template, "-v", "ON_ERROR_STOP=1", "-q", "-f", stub]);
  }
  for (const f of files) {
    await run("psql", [...psql, "-d", PG.template, "-v", "ON_ERROR_STOP=1", "-q",
      "-f", join(migrations, f)], { maxBuffer: 64 << 20 });
  }
  await run("psql", [...psql, "-d", PG.template, "-c",
    `create table public._test_template_fingerprint (fingerprint text primary key);
     insert into public._test_template_fingerprint values ('${want}')`]);
}

function runSuite(s) {
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn("node", ["--experimental-strip-types", s.path], {
      cwd: ROOT,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => {
      const summary = out.match(/^(\d+) passed, (\d+) failed$/m);
      resolve({
        ...s,
        code,
        seconds: ((Date.now() - started) / 1000).toFixed(1),
        passed: summary ? Number(summary[1]) : null,
        failed: summary ? Number(summary[2]) : null,
        failures: out.split("\n").filter((l) => l.startsWith("FAIL ")),
        out,
      });
    });
  });
}

const needsApp = suites.some((s) => s.kind === "browser");
const needsPg = suites.some((s) => s.kind === "db");

try {
  if (needsApp) {
    await startDouble();
    await startApp();
  }
  if (needsPg) {
    await prepareTemplate();
    const swept = await sweepScratchDatabases();
    if (swept) console.log(`· swept ${swept} scratch database(s) left by a previous run`);
  }

  console.log("");
  const results = [];
  for (const s of suites) {
    process.stdout.write(`${s.name.padEnd(16)} `);
    const r = await runSuite(s);
    results.push(r);
    if (r.passed === null) {
      console.log(r.code === 0 ? `ran (no assertions) ${r.seconds}s` : `ERRORED ${r.seconds}s`);
    } else {
      console.log(`${r.passed} passed, ${r.failed} failed  ${r.seconds}s`);
    }
    for (const f of r.failures) console.log(`   ${f}`);
    // An errored suite has no summary line, so print enough to diagnose.
    if (r.code !== 0 && r.passed === null) {
      console.log(r.out.split("\n").slice(-12).map((l) => "   " + l).join("\n"));
    }
  }

  // A suite with failing assertions exits non-zero on purpose. "Did not
  // complete" means something else: no summary line at all, i.e. it threw
  // before it could report. Conflating the two made a legitimately
  // failing suite look like a broken one.
  const broken = results.filter((r) => r.passed === null && r.code !== 0);
  const totalPassed = results.reduce((n, r) => n + (r.passed ?? 0), 0);
  const totalFailed = results.reduce((n, r) => n + (r.failed ?? 0), 0);
  console.log(
    `\n${results.length} suites · ${totalPassed} passed · ${totalFailed} failed` +
      (broken.length ? ` · ${broken.length} suite(s) did not complete` : ""),
  );
  process.exitCode = Math.min(broken.length + (totalFailed > 0 ? 1 : 0), 125);
} finally {
  stopServices();
}

// An interrupted run must not leave a server on the port either.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { stopServices(); process.exit(130); });
}
