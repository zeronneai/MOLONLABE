#!/usr/bin/env node
// Writes lib/guides/version.ts — the renderer's identity, hashed.
//
//   node scripts/gen-guide-version.mjs          # write it
//   node scripts/gen-guide-version.mjs --check  # fail if it is stale
//
// Runs as the first step of `npm run build`.
//
// WHY THIS IS GENERATED RATHER THAN TYPED
//
// A guide is rebuilt when its fingerprint changes, and the fingerprint
// covers everything that goes INTO the document: the owner's three
// sections, the item's copy, its photograph URLs. What it could not see
// was a change to the code that turns those inputs into a page.
//
// That gap shipped. The photographs were fixed by converting WebP to
// JPEG before the renderer sees them — a change to `images.ts` and to
// nothing else. Every game whose guide had already been built therefore
// had an unchanged fingerprint, so `refreshGuide` returned early and
// served the old, blank PDF out of storage. Nothing rendered, so there
// was nothing in the log either. The fix was deployed and changed
// nothing, twice, and looked like a rendering bug.
//
// There WAS a `GUIDE_VERSION = "1"` constant for exactly this, with a
// line in docs/guides.md saying to bump it. It was not bumped, because a
// constant somebody has to remember is the same as no constant — the
// same lesson as the bundle check, learned twice in one feature.
//
// So the version is derived from the thing it describes: a hash of every
// file that decides what the document looks like, plus the versions of
// the two packages that do the drawing. Change any of them and every
// guide rebuilds on next read, with nothing to remember.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "lib", "guides", "version.ts");

/**
 * Everything that can change what comes out of the renderer.
 *
 * `build.ts` is in here because it decides which data reaches the
 * document; `fields.ts` is not, because it only validates. Adding a file
 * is cheap — the cost of a wrong entry is one extra rebuild per game,
 * and the cost of a missing one is a stale guide nobody can explain.
 */
const SOURCES = [
  "lib/guides/Document.tsx",
  "lib/guides/theme.ts",
  "lib/guides/images.ts",
  "lib/guides/fonts.ts",
  "lib/guides/build.ts",
];

/** The packages that do the drawing. A major bump changes output. */
const PACKAGES = ["@react-pdf/renderer", "sharp", "pdfkit"];

export function guideRendererVersion() {
  const hash = createHash("sha256");
  for (const file of SOURCES) {
    hash.update(file);
    hash.update(readFileSync(join(ROOT, file)));
  }
  for (const pkg of PACKAGES) {
    let version = "absent";
    try {
      version = JSON.parse(
        readFileSync(join(ROOT, "node_modules", pkg, "package.json"), "utf8"),
      ).version;
    } catch {
      /* not installed is itself a distinguishing fact */
    }
    hash.update(`${pkg}@${version}`);
  }
  return hash.digest("hex").slice(0, 16);
}

function fileFor(version) {
  return `// GENERATED FILE — do not edit by hand.
//
// Written by scripts/gen-guide-version.mjs, which runs as the first step
// of \`npm run build\`. It is a hash of every source file that decides
// what a guide looks like, plus the versions of the packages that draw
// it.
//
// It is part of the guide's fingerprint, so changing the renderer
// rebuilds every guide on next read — WITHOUT anybody having to remember
// to bump a number. The constant this replaced was not bumped when the
// WebP conversion landed, and the whole catalogue kept serving blank
// guides out of storage as a result.
//
// It is committed so that a test run and a deployment agree about what
// the current renderer is; \`npm test\` fails if it has gone stale.
export const GUIDE_RENDERER_VERSION = "${version}";
`;
}

const version = guideRendererVersion();
const wanted = fileFor(version);

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* missing counts as stale */
  }
  if (current !== wanted) {
    console.error(
      `lib/guides/version.ts is stale.\n` +
        `The guide renderer changed and the version did not, which means every\n` +
        `already-built guide would keep serving out of storage unchanged.\n\n` +
        `Run: node scripts/gen-guide-version.mjs`,
    );
    process.exit(1);
  }
  console.log(`guide renderer version ${version} — current`);
  process.exit(0);
}

writeFileSync(OUT, wanted);
console.log(`guide renderer version ${version}`);
