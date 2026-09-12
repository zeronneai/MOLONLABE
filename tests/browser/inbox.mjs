// The order_error message as it lands, in the two fonts a client might
// pick for text/plain. Proportional is the default in Gmail's web view,
// Apple Mail and Outlook, so it is the one that matters.

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { ARTIFACTS, CHROMIUM } from "../lib/config.mjs";


const notes = JSON.parse(readFileSync(`${ARTIFACTS}/urgent.json`, "utf8"));
const n = notes.find((x) => x.kind === "order_error");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Deliberately plain chrome — this is a preview of the message, not a
// mock of anyone's product.
const page = (font, label) => `<!doctype html>
<meta charset="utf-8">
<style>
  body { margin:0; background:#e8e6e1; font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 40px; }
  .note { font-size:12px; color:#6b6c70; margin:0 0 12px; }
  .msg { background:#fff; border:1px solid #d5d2cc; }
  .hdr { padding:18px 22px; border-bottom:1px solid #eae7e2; }
  .subj { font-size:19px; font-weight:700; color:#16151a; margin:0 0 8px; line-height:1.3; }
  .meta { font-size:13px; color:#6b6c70; margin:0; }
  .body { padding:22px; font-size:14px; line-height:1.55; color:#16151a;
          white-space: pre-wrap; font-family:${font}; }
</style>
<div class="wrap">
  <p class="note">${esc(label)}</p>
  <div class="msg">
    <div class="hdr">
      <p class="subj">${esc(n.subject)}</p>
      <p class="meta">Molon Labe Firearms website &lt;orders@…&gt;<br>to me · ${esc(
        new Date(n.submitted_at).toUTCString(),
      )}</p>
    </div>
    <div class="body">${esc(n.summary)}</div>
  </div>
</div>`;

const b = await chromium.launch({ executablePath: CHROMIUM });
for (const [file, font, label] of [
  [
    "inbox-proportional",
    "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
    "As it renders in a proportional font — Gmail web, Apple Mail, Outlook.",
  ],
  [
    "inbox-monospace",
    "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
    "As it renders in a monospace font — some clients, and Gmail's fixed-width setting.",
  ],
]) {
  writeFileSync(`${ARTIFACTS}/${file}.html`, page(font, label));
  const c = await b.newContext({
    viewport: { width: 760, height: 1200 },
    deviceScaleFactor: 2,
  });
  const p = await c.newPage();
  await p.goto(`file://${ARTIFACTS}/${file}.html`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${ARTIFACTS}/${file}.png`, fullPage: true });
  await c.close();
  console.log("shot", file);
}
await b.close();

writeFileSync(`${ARTIFACTS}/order-error.txt`, `Subject: ${n.subject}\n\n${n.summary}\n`);
console.log("\nSUBJECT:", n.subject);
console.log("body bytes:", Buffer.byteLength(n.summary));
