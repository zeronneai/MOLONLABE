#!/usr/bin/env node
// No "spot", "ticket", "raffle" or "lottery" in anything a person reads.
//
//   node scripts/check-copy.mjs          # fails the build on a hit
//   node scripts/check-copy.mjs --list   # every hit, including allowed ones
//
// The attorney's ruling: what a customer buys is a guide to the featured
// piece, and entry into the drawing comes with it. The four words
// describe a different legal product, so they may not appear on any
// surface a customer or a member of staff can read: pages, metadata,
// the cart and checkout, emails, the guide PDF, alerts, the admin, and
// the draw presentation.
//
// WHAT IT READS
//
// Every string and every piece of JSX text in app/, components/,
// content/ and lib/, found by parsing the source rather than by searching it. That is
// what lets the database keep its names: `game_spots`, `spot_number` and
// `spotNumber` are identifiers, not copy, and a comment explaining the
// history is not copy either. A word search would have to either miss
// real copy or flag every column name, and a check that cries wolf gets
// switched off.
//
// WHAT IT SKIPS, AND WHY EACH IS SAFE
//
//   - Strings passed to the database query builder (.from, .select,
//     .eq, .rpc, .order …). They name tables and columns, which keep
//     their names by instruction, and nobody reads them.
//   - Module paths, and string literal TYPES.
//   - A line explicitly marked `// copy-check: internal <reason>`,
//     for the rare string that is neither of the above and is never
//     shown. The reason is required, and --list prints every one.
//
// EM DASHES
//
// The client does not want em dashes anywhere a customer reads: the
// public pages, their titles and metadata, the cart and checkout and
// every message they can show, the confirmation email, the guide PDF,
// and the draw presentation, which is broadcast. The same parse flags
// them in every file except the ones only staff ever see (EM_DASH_STAFF
// below) and strings handed to a logger, which go to the server log.
// tests/browser/wording.mjs reads the rendered public pages for them too.
//
// What it cannot see is text that lives in the database: a game title
// the owner typed, or wording stored on an order when it was placed.
// Those are the owner's words or a record of what a buyer agreed to, and
// neither is ours to rewrite. tests/browser/wording.mjs reads the
// rendered pages, emails and PDF for the four words as well.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["app", "components", "content", "lib"];
const BANNED = /\b(spots?|tickets?|raffles?|lotter(?:y|ies))\b/i;
const EM_DASH = "\u2014";

/**
 * Files only staff read: the admin, and the owner's alerts. Everything
 * else in app/, components/, content/ and lib/ can reach a customer, directly or
 * through a shared string, so it is checked for em dashes.
 */
const EM_DASH_STAFF = [/^app\/admin\//, /^components\/admin\//, /^lib\/admin\//, /^lib\/notify\.ts$/];

/** A string passed to a logger goes to the server log, not to a person. */
function isLogArgument(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const name = ts.isPropertyAccessExpression(c)
        ? `${c.expression.getText()}.${c.name.text}`
        : ts.isIdentifier(c) ? c.text : "";
      if (/^console\.\w+$/.test(name) || /^\w*[lL]og$/.test(name)) return true;
    }
    if (ts.isFunctionLike(n) || ts.isBlock(n)) return false;
  }
  return false;
}

/** Query builder methods whose string arguments are table or column names. */
const DB_METHODS = new Set([
  "from", "select", "eq", "neq", "in", "is", "not", "or", "order", "rpc",
  "like", "ilike", "gt", "gte", "lt", "lte", "match", "filter", "contains",
  "upsert", "range", "limit", "single", "maybeSingle", "textSearch",
]);

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(tsx?|mjs)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function isDbArgument(node) {
  const call = node.parent;
  if (!call || !ts.isCallExpression(call) || !call.arguments.includes(node)) return false;
  const callee = call.expression;
  return ts.isPropertyAccessExpression(callee) && DB_METHODS.has(callee.name.text);
}

function isModulePath(node) {
  const p = node.parent;
  return (
    (p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === node) ||
    (p && ts.isExternalModuleReference(p)) ||
    (p && ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword)
  );
}

function isTypePosition(node) {
  return node.parent && ts.isLiteralTypeNode(node.parent);
}

/** A property NAME written as a string: { "spot": 1 }. Not copy. */
function isPropertyName(node) {
  const p = node.parent;
  return p && (ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === node;
}

const hits = [];
const allowed = [];
const dashes = [];

for (const file of DIRS.flatMap((d) => files(join(ROOT, d)))) {
  const rel = relative(ROOT, file);
  // Generated from the database, and every string in it is a column name.
  if (rel === "lib/database.types.ts") continue;
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const checkDashes = !EM_DASH_STAFF.some((re) => re.test(rel));
  const sf = ts.createSourceFile(
    file, src, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node) => {
    let text = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isDbArgument(node) && !isModulePath(node) && !isTypePosition(node) && !isPropertyName(node)) {
        text = node.text;
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      text = node.text;
    } else if (ts.isJsxText(node)) {
      text = node.text;
    }
    if (text && checkDashes && text.includes(EM_DASH) && !isLogArgument(node)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
      dashes.push({ where: `${rel}:${line + 1}`, text: text.replace(/\s+/g, " ").trim().slice(0, 90) });
    }
    if (text && BANNED.test(text)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
      const marker = [lines[line], lines[line - 1] ?? ""]
        .map((l) => l.match(/copy-check:\s*internal\s+(.+)$/))
        .find(Boolean);
      const hit = {
        where: `${rel}:${line + 1}`,
        word: text.match(BANNED)[0],
        text: text.replace(/\s+/g, " ").trim().slice(0, 90),
      };
      if (marker) allowed.push({ ...hit, reason: marker[1].trim() });
      else hits.push(hit);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (process.argv.includes("--list")) {
  for (const d of dashes) console.log(`DASH     ${d.where}  ${d.text}`);
  for (const h of hits) console.log(`HIT      ${h.where}  "${h.word}"  ${h.text}`);
  for (const a of allowed) console.log(`INTERNAL ${a.where}  "${a.word}"  (${a.reason})`);
  console.log(`\n${hits.length} in copy, ${allowed.length} marked internal`);
  process.exit(hits.length || dashes.length ? 1 : 0);
}

if (dashes.length) {
  console.error(
    `copy check: ${dashes.length} em dash(es) a customer could read. The client ` +
      `does not want them in the copy; use a full stop, a colon or a comma.\n`,
  );
  for (const d of dashes) console.error(`  ${d.where}  ${d.text}`);
  console.error("");
}

if (hits.length) {
  console.error(
    `copy check: ${hits.length} place(s) a person could read "spot", "ticket", ` +
      `"raffle" or "lottery".\nWhat a customer buys is a guide; entry into the ` +
      `drawing comes with it. See docs/wording.md.\n`,
  );
  for (const h of hits) console.error(`  ${h.where}  "${h.word}"  ${h.text}`);
  console.error(
    `\nIf a string is genuinely never shown to anyone, mark its line\n` +
      `  // copy-check: internal <why nobody reads it>`,
  );
  process.exit(1);
}
if (dashes.length) process.exit(1);
console.log(`copy check: no banned words and no em dashes in user-facing copy (${allowed.length} internal strings marked)`);
