#!/usr/bin/env node
// Does the DEPLOYED bundle have the files it needs?
//
//   npm run check:bundle          build, then check
//   npm run check:bundle -- --no-build   check an existing standalone build
//
// WHY THIS EXISTS
//
// The browser suite runs against the repository, where every file is
// present whether or not the build traced it. That makes it structurally
// blind to the one failure that has actually reached production here: a
// file loaded by a path computed at runtime, which the tracer cannot see
// and therefore does not ship.
//
// It cost a live checkout. `@react-pdf/renderer` pulls in pdfkit, and
// pdfkit reaches its standard fonts through a require built at runtime:
//
//   const require$1 = module.createRequire(pathToFileURL(__filename));
//   registerStdFontLoaders({ Helvetica: () => require$1('#standard-fonts/Helvetica'), … });
//
// Nothing static to follow. The deployed function had no Helvetica.cjs,
// and because react-pdf loads the standard fonts EAGERLY when it is
// imported, the failure arrived as unhandled promise rejections at module
// scope — not as an exception any caller could catch.
//
// WHAT THIS DOES THAT READING THE TRACE DOES NOT
//
// `.next/server/**/*.nft.json` lists what was traced, and checking it is
// worth something — but it said the fonts were present at a point when
// the build was still broken, because each font file requires a shared
// chunk from a subdirectory beside it and the glob only went one level
// deep. Counting files could not see that. Running the code could.
//
// So the real check is the last one below: import the renderer from
// inside the assembled bundle, with the repository out of reach, and draw
// a page. If anything it needs was left behind, this is where it says so.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE = join(ROOT, ".next", "standalone");
const build = !process.argv.includes("--no-build");

const ok = [];
const bad = [];
const check = (label, passed, detail = "") =>
  (passed ? ok : bad).push(
    `${passed ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );

// ---------------------------------------------------------------------
// 1. Build the thing that gets deployed
// ---------------------------------------------------------------------
if (build) {
  console.log("· building (standalone output)…");
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: ROOT,
      env: { ...process.env, NEXT_BUNDLE_CHECK: "1" },
      stdio: ["ignore", "ignore", "pipe"],
      maxBuffer: 64 << 20,
    });
  } catch (error) {
    console.error(String(error.stderr ?? error).split("\n").slice(-20).join("\n"));
    console.error("\nThe build failed. Nothing else here can mean anything.");
    process.exit(2);
  }
}

if (!existsSync(STANDALONE)) {
  console.error(
    `No standalone build at ${STANDALONE}.\n` +
      `Run without --no-build, or: NEXT_BUNDLE_CHECK=1 npm run build`,
  );
  process.exit(2);
}

// ---------------------------------------------------------------------
// 2. Files that must be in the bundle, and are only there on purpose
// ---------------------------------------------------------------------
// Everything in this list is reached by a computed path at runtime, so
// nothing about it is enforced by an import anywhere. Each entry names
// why it is here; an entry with no reason is an entry nobody can safely
// remove.
const REQUIRED = [
  {
    path: "lib/guides/fonts/Archivo-Regular.ttf",
    why: "lib/guides/fonts.ts reads it from process.cwd() at render time",
  },
  {
    path: "lib/guides/fonts/Archivo-SemiBold.ttf",
    why: "same",
  },
  {
    path: "lib/guides/fonts/Archivo-ExtraBold.ttf",
    why: "same",
  },
  {
    path: "node_modules/pdfkit/js/standard-fonts/Helvetica.cjs",
    why: "pdfkit requires it through a runtime createRequire; react-pdf loads it on import",
  },
  {
    path: "node_modules/pdfkit/js/standard-fonts/chunks",
    why: "every standard font requires a shared chunk from here",
  },
];

for (const { path, why } of REQUIRED) {
  check(`bundle carries ${path}`, existsSync(join(STANDALONE, path)), why);
}

const fontDir = join(STANDALONE, "node_modules/pdfkit/js/standard-fonts");
if (existsSync(fontDir)) {
  const cjs = readdirSync(fontDir).filter((f) => f.endsWith(".cjs"));
  check("all fourteen standard fonts are there, not just the one we name",
    cjs.length === 14, `${cjs.length} of 14`);
}

// ---------------------------------------------------------------------
// 3. The trace agrees, for every entry point
// ---------------------------------------------------------------------
// Cheap, and it catches the case where the files are in the standalone
// directory but a particular serverless function did not ask for them.
function nftFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...nftFiles(full));
    else if (entry.name.endsWith(".nft.json")) out.push(full);
  }
  return out;
}
const traces = existsSync(join(ROOT, ".next/server/app"))
  ? nftFiles(join(ROOT, ".next/server/app"))
  : [];
const needsFonts = traces.filter((f) =>
  JSON.parse(readFileSync(f, "utf8")).files.some((x) => x.includes("Archivo")),
);
const missingStdFonts = needsFonts.filter(
  (f) => !JSON.parse(readFileSync(f, "utf8")).files.some((x) => x.includes("standard-fonts")),
);
check(
  "every entry that traces Archivo also traces pdfkit's standard fonts",
  needsFonts.length > 0 && missingStdFonts.length === 0,
  missingStdFonts.length
    ? missingStdFonts.map((f) => f.replace(ROOT + "/", "")).join(", ")
    : `${needsFonts.length} entries`,
);

// ---------------------------------------------------------------------
// 4. The one that actually proves it: render from inside the bundle
// ---------------------------------------------------------------------
// cwd is the standalone directory, so `process.cwd()` resolves the way it
// does in /var/task and the repository's own node_modules is not on the
// resolution path. An unhandled rejection is failure, not a warning:
// that is the shape this failure takes, and a serverless runtime is
// entitled to kill the invocation over one.
const probe = `
  const { readdirSync } = require("node:fs");
  const { join } = require("node:path");
  let rejections = 0;
  process.on("unhandledRejection", (e) => {
    rejections++;
    console.error("UNHANDLED REJECTION:", e && e.code, String(e).slice(0, 160));
  });
  (async () => {
    const React = require("react");
    const { Document, Page, Text, Font, renderToBuffer } = await import("@react-pdf/renderer");
    const dir = join(process.cwd(), "lib", "guides", "fonts");
    Font.register({
      family: "Archivo",
      fonts: [{ src: join(dir, "Archivo-Regular.ttf"), fontWeight: 400 }],
    });
    const e = React.createElement;
    const buf = await renderToBuffer(
      e(Document, null, e(Page, { size: "LETTER" },
        e(Text, { style: { fontFamily: "Archivo" } }, "archivo"),
        e(Text, null, "standard font"))),
    );
    // Give any out-of-band rejection a tick to land before judging.
    await new Promise((r) => setTimeout(r, 300));
    if (rejections > 0) {
      console.error("RESULT: " + rejections + " unhandled rejection(s)");
      process.exit(1);
    }
    if (!buf || buf.length < 500 || buf.subarray(0, 5).toString() !== "%PDF-") {
      console.error("RESULT: not a PDF");
      process.exit(1);
    }
    console.log("RESULT: rendered " + buf.length + " bytes, no rejections");
  })().catch((e) => {
    console.error("RESULT: threw —", e && e.message);
    process.exit(1);
  });
`;

const run = spawnSync(process.execPath, ["-e", probe], {
  cwd: STANDALONE,
  encoding: "utf8",
  timeout: 60_000,
});
const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
check(
  "the renderer works from inside the bundle, with the repo out of reach",
  run.status === 0,
  (output.split("\n").find((l) => l.startsWith("RESULT:")) ?? output.slice(0, 200)) || "no output",
);
if (run.status !== 0 && output) {
  for (const line of output.split("\n").slice(0, 8)) bad.push(`     ${line}`);
}

// ---------------------------------------------------------------------
for (const line of ok) console.log(line);
for (const line of bad) console.log(line);
console.log(`\n${ok.length} passed, ${bad.filter((l) => l.startsWith("FAIL")).length} failed`);
process.exit(bad.some((l) => l.startsWith("FAIL")) ? 1 : 0);
