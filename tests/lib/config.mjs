// Where everything lives. Nothing in the suite hardcodes a path or a port.
//
// Defaults are chosen so `npm test` works with no environment set at all;
// every value can be overridden for CI or for pointing the browser tests
// at a deployed preview.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Repository root, derived from this file rather than assumed. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The app under test. */
export const APP = process.env.TEST_APP ?? "http://localhost:3500";
export const APP_PORT = Number(new URL(APP).port || 80);

/** The Supabase + Authorize.net stand-in. */
export const DOUBLE = process.env.TEST_DOUBLE ?? "http://127.0.0.1:4010";
export const DOUBLE_PORT = Number(new URL(DOUBLE).port || 80);

/**
 * Scratch space for artifacts a test writes and later asserts on —
 * rendered emails, screenshots. Outside the repository by default so a
 * test run never dirties the working tree.
 */
export const ARTIFACTS =
  process.env.TEST_ARTIFACTS ?? join(process.env.TMPDIR ?? "/tmp", "mlf-test-artifacts");

/**
 * Chromium. Left undefined so Playwright resolves its own download,
 * which is the portable behaviour; set TEST_CHROMIUM only where the
 * browser lives somewhere Playwright will not look.
 */
export const CHROMIUM = process.env.TEST_CHROMIUM || undefined;

/**
 * PostgreSQL, for the tests that cannot run against the double.
 * Concurrency is the obvious case: the double is single-threaded
 * JavaScript, so it serialises every request and would pass a race test
 * whether or not the SQL is correct.
 */
export const PG = {
  host: process.env.TEST_PGHOST ?? "/tmp",
  port: process.env.TEST_PGPORT ?? "5433",
  user: process.env.TEST_PGUSER ?? "postgres",
  /** Built once by the runner; each db test clones it and drops the clone. */
  template: process.env.TEST_PGTEMPLATE ?? "mlf_template",
};

/** The seeded admin login the double accepts. */
export const OWNER = {
  email: "owner@molonlabe.example",
  password: "x",
};
