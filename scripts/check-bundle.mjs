#!/usr/bin/env node
// Does the DEPLOYED bundle have the files it needs?
//
// Runs as part of `npm run build`, so it cannot be forgotten. That is the
// whole design: it guards a class of failure that only exists after
// bundling, and it already cost a live purchase once while a green test
// suite watched.
//
//   npm run build          builds, then checks
//   npm run check:bundle   checks an existing build, without rebuilding
//
// WHAT IT IS GUARDING
//
// The browser suite runs against the repository, where every file is
// present whether or not the build traced it into the deployed function.
// It is structurally blind to a file loaded by a path computed at
// runtime — which is how `@react-pdf/renderer` reaches pdfkit, and how
// pdfkit reaches its standard fonts:
//
//   const require$1 = module.createRequire(pathToFileURL(__filename));
//   registerStdFontLoaders({ Helvetica: () => require$1('#standard-fonts/Helvetica'), … });
//
// Nothing static to follow. The deployed function had no Helvetica.cjs,
// and because react-pdf loads the standard fonts EAGERLY on import, the
// failure arrived as unhandled promise rejections at module scope — not
// as an exception any caller could catch.
//
// HOW IT CHECKS
//
// `.next/server/**/*.nft.json` is the list of files the build decided
// each entry point needs, and it is the same list a serverless platform
// assembles that function from. This reads those lists, asserts what must
// be in them, and then — the part that matters — REBUILDS ONE OF THEM ON
// DISK and runs the renderer inside it, with the repository out of
// resolution's reach.
//
// Reading the list is not enough on its own. The first fix here shipped
// all fourteen standard fonts and still failed on the deployment, because
// each of them requires a shared chunk from a `chunks/` subdirectory and
// the glob only went one level deep. Counting traced files said
// everything was present. Running the code said otherwise.

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(ROOT, ".next", "server", "app");

const ok = [];
const bad = [];
const check = (label, passed, detail = "") =>
  (passed ? ok : bad).push(
    `${passed ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );

function fail(message) {
  console.error(`\nBUNDLE CHECK: ${message}`);
  process.exit(2);
}

// ---------------------------------------------------------------------
// The traces
// ---------------------------------------------------------------------

if (!existsSync(APP_DIR)) {
  fail(
    `no build to check at ${relative(ROOT, APP_DIR)}.\n` +
      `This runs after \`next build\`; run \`npm run build\`.`,
  );
}

function traceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...traceFiles(full));
    else if (entry.name.endsWith(".nft.json")) out.push(full);
  }
  return out;
}

/** One entry point: its name, and every file the build says it needs. */
const entries = traceFiles(APP_DIR).map((tracePath) => {
  const base = dirname(tracePath);
  const { files } = JSON.parse(readFileSync(tracePath, "utf8"));
  return {
    name: relative(APP_DIR, tracePath).replace(/\.js\.nft\.json$/, ""),
    // Absolute, and relative to the project root — the second is the path
    // the file has inside the deployed function.
    files: files
      .map((f) => resolve(base, f))
      .filter((f) => f.startsWith(ROOT + "/"))
      .map((f) => ({ from: f, at: relative(ROOT, f) })),
  };
});

const has = (entry, needle) => entry.files.some((f) => f.at.includes(needle));

// ---------------------------------------------------------------------
// What must be true of every entry that carries the renderer
// ---------------------------------------------------------------------
// Declared by what the entry contains, never by a list of route names. A
// hand-kept list of "the routes that render a guide" is a list that goes
// stale in silence, which is the same disease as the bug.
const RENDERER = "node_modules/@react-pdf/renderer/";

const REQUIRED = [
  {
    at: "lib/guides/fonts/Archivo-Regular.ttf",
    why: "lib/guides/fonts.ts reads it from process.cwd() at render time",
  },
  { at: "lib/guides/fonts/Archivo-SemiBold.ttf", why: "same" },
  { at: "lib/guides/fonts/Archivo-ExtraBold.ttf", why: "same" },
  {
    at: "node_modules/pdfkit/js/standard-fonts/Helvetica.cjs",
    why: "pdfkit requires it through a runtime createRequire; react-pdf loads it on import",
  },
  {
    at: "node_modules/pdfkit/js/standard-fonts/chunks/",
    why: "every standard font requires a shared chunk from here",
  },
];

const carriers = entries.filter((e) => has(e, RENDERER));

// The guard against a check that quietly stops checking. If the renderer
// is ever removed this should be deleted deliberately, not left passing
// over nothing.
check(
  "the build has entry points carrying the PDF renderer",
  carriers.length > 0,
  carriers.length ? `${carriers.length} of ${entries.length}` : "NONE — is this check still needed?",
);

for (const { at, why } of REQUIRED) {
  const missing = carriers.filter((e) => !has(e, at));
  check(
    `every entry carrying the renderer also carries ${at}`,
    carriers.length > 0 && missing.length === 0,
    missing.length ? `missing from ${missing.map((e) => e.name).join(", ")}` : why,
  );
}

const shortFonts = carriers.filter(
  (e) =>
    e.files.filter(
      (f) => f.at.includes("standard-fonts/") && f.at.endsWith(".cjs"),
    ).length < 14,
);
check(
  "all fourteen standard fonts travel, not just the one we name",
  shortFonts.length === 0,
  shortFonts.length
    ? shortFonts
        .map(
          (e) =>
            `${e.name}: ${e.files.filter((f) => f.at.includes("standard-fonts/") && f.at.endsWith(".cjs")).length}`,
        )
        .join(", ")
    : "14 in each",
);

// ---------------------------------------------------------------------
// The one that actually proves it
// ---------------------------------------------------------------------
// Assemble an entry's traced files into a directory and render from
// inside it. cwd is that directory, so `process.cwd()` resolves the way
// it does in /var/task, and the repository's own node_modules is not on
// the resolution path.
//
// One probe per DISTINCT set of renderer files rather than one per entry:
// thirty-eight entries carrying byte-identical copies of pdfkit prove the
// same thing thirty-eight times, and a check that takes a minute is a
// check somebody eventually takes out of the build.
const relevant = (entry) =>
  entry.files
    .map((f) => f.at)
    .filter((at) => at.includes("pdfkit/") || at.includes("@react-pdf/") || at.includes("lib/guides/fonts/"))
    .sort()
    .join("\n");

const groups = new Map();
for (const entry of carriers) {
  const key = createHash("sha256").update(relevant(entry)).digest("hex");
  if (!groups.has(key)) groups.set(key, entry);
}

const PROBE = `
  const { join } = require("node:path");
  let rejections = [];
  process.on("unhandledRejection", (e) => rejections.push(String(e && e.message || e)));
  (async () => {
    const React = require("react");
    const { Document, Page, Text, Font, renderToBuffer } = await import("@react-pdf/renderer");
    Font.register({
      family: "Archivo",
      fonts: [{ src: join(process.cwd(), "lib", "guides", "fonts", "Archivo-Regular.ttf"), fontWeight: 400 }],
    });
    const e = React.createElement;
    const buf = await renderToBuffer(
      e(Document, null, e(Page, { size: "LETTER" },
        e(Text, { style: { fontFamily: "Archivo" } }, "archivo"),
        e(Text, null, "standard font"))),
    );
    // An out-of-band rejection lands a tick or two after the work. Give
    // it time: this failure's whole character is that it arrives late and
    // attached to nothing.
    await new Promise((r) => setTimeout(r, 400));
    if (rejections.length) {
      console.error("RESULT: " + rejections.length + " unhandled rejection(s) — " + rejections[0].slice(0, 120));
      process.exit(1);
    }
    if (!buf || buf.length < 500 || buf.subarray(0, 5).toString() !== "%PDF-") {
      console.error("RESULT: not a PDF");
      process.exit(1);
    }
    console.log("RESULT: rendered " + buf.length + " bytes, no rejections");
  })().catch((e) => {
    console.error("RESULT: threw — " + (e && e.message));
    process.exit(1);
  });
`;

for (const entry of groups.values()) {
  const dir = mkdtempSync(join(tmpdir(), "mlf-bundle-"));
  try {
    for (const file of entry.files) {
      const target = join(dir, file.at);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(file.from, target, { recursive: true, dereference: true });
    }
    const run = spawnSync(process.execPath, ["-e", PROBE], {
      cwd: dir,
      encoding: "utf8",
      timeout: 90_000,
    });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
    const result =
      output.split("\n").find((l) => l.startsWith("RESULT:")) ??
      output.split("\n")[0] ??
      "no output";
    check(
      `the renderer works from ${entry.name}'s files alone`,
      run.status === 0,
      result,
    );
    if (run.status !== 0) {
      for (const line of output.split("\n").slice(0, 10)) bad.push(`     ${line}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------
for (const line of ok) console.log(line);
for (const line of bad) console.log(line);

const failures = bad.filter((l) => l.startsWith("FAIL")).length;
console.log(`\nbundle check: ${ok.length} passed, ${failures} failed`);
if (failures > 0) {
  console.log(
    `\nThe build produced a bundle that is missing a file it loads by path\n` +
      `at runtime. It would deploy, and fail on the first request that needs\n` +
      `that file. Add it to outputFileTracingIncludes in next.config.ts.\n` +
      `See docs/guides.md, "The deployment bug".`,
  );
}
process.exit(failures > 0 ? 1 : 0);
