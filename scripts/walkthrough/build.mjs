#!/usr/bin/env node
// Lays the captured frames out and prints docs/site-walkthrough.pdf.
//
//   node scripts/walkthrough/build.mjs
//
// Run capture.mjs first. Any frame that is missing renders as a marked
// pending panel rather than being quietly dropped, and the cover says so,
// because a walkthrough with invented pictures in it is worse than one
// with visible gaps.
//
// The layout follows DESIGN.md: Archivo 800 at tight negative tracking
// for headlines, tiny letterspaced uppercase labels, hairlines instead of
// shadows, square corners, ink and bone, acid used once per page at most.
// Copy hangs off a left rule and the images escape it to the right edge —
// the same composition rule the site itself uses.

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { SHOTS } from "./shots.mjs";

const FRAMES = path.resolve("docs/walkthrough-frames");
const OUT = path.resolve("docs/site-walkthrough.pdf");
const SCRATCH = path.resolve(".walkthrough-build");

const exists = async (p) => access(p).then(() => true).catch(() => false);

// Archivo, as the build already fetched it. Embedded rather than linked
// so the document renders the same with no network, now or in five years.
async function fontFace() {
  const dir = path.resolve(".next/static/media");
  const candidates = ["1a4aa50920b5315c-s.p.woff2"];
  for (const name of candidates) {
    const file = path.join(dir, name);
    if (await exists(file)) {
      const b64 = (await readFile(file)).toString("base64");
      // One variable file serves every weight; next/font splits it by
      // unicode range, and this is the basic-latin cut.
      return `@font-face{font-family:Archivo;font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
    }
  }
  return "";
}

async function frameSrc(id) {
  const file = path.join(FRAMES, `${id}.png`);
  return (await exists(file)) ? `file://${file}` : null;
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function panel(frame) {
  const src = await frameSrc(frame.id);
  const note = frame.note
    ? `<p class="frame-note">${esc(frame.note)}</p>`
    : "";
  if (!src) {
    return `<figure class="frame frame--${frame.kind} pending">
      <div class="pending-box"><p class="label">Screenshot pending</p><p class="pending-id">${esc(frame.id)}</p></div>
      ${note}
    </figure>`;
  }
  return `<figure class="frame frame--${frame.kind}">
    <img src="${src}" alt="">
    ${note}
  </figure>`;
}

async function sectionPage(shot) {
  const panels = (await Promise.all(shot.frames.map(panel))).join("");
  const many = shot.frames.length > 1;
  return `<section class="page page--section">
    <div class="copy">
      <p class="label num">${esc(shot.n)}</p>
      <p class="label eyebrow">${esc(shot.label)}</p>
      <h2 class="title">${esc(shot.title)}</h2>
      <p class="caption">${esc(shot.caption)}</p>
    </div>
    <div class="plate ${many ? "plate--row" : "plate--single"} plate--${shot.frames[0].kind}">
      ${panels}
    </div>
  </section>`;
}

async function coverPage(pending) {
  const mark = await frameSrc("mark");
  const warn = pending.length
    ? `<div class="proof">
        <p class="label">Layout proof — not for the client</p>
        <p class="proof-body">${pending.length} of ${
          SHOTS.flatMap((s) => s.frames).length
        } screenshots have not been captured yet. Run the capture against the deployed
        preview and rebuild before this goes out.</p>
      </div>`
    : "";
  return `<section class="page page--cover">
    ${mark ? `<img class="mark" src="${mark}" alt="">` : `<div class="mark mark--missing"></div>`}
    <div class="cover-body">
      <p class="label cover-label">Website walkthrough</p>
      <h1 class="cover-title">MOLON LABE<br>FIREARMS<span class="x">×</span><br>SUNCITY<br>OUTDOORS</h1>
    </div>
    ${warn}
    <div class="cover-foot">
      <p class="label">Purple Roots Agency</p>
      <p class="label">${new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}</p>
    </div>
  </section>`;
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --ink:#0b0a0c; --surface:#131417; --bone:#f2efe7; --muted:#8a8b8f;
  --acid:#57b94a;
  --hair:rgba(138,139,143,.22);
  --pad:14mm;
}
html,body{background:var(--ink);color:var(--bone);
  font-family:Archivo,system-ui,sans-serif;-webkit-font-smoothing:antialiased}

/* A4 landscape. Every page is exactly one sheet — no widows, no reflow. */
.page{
  position:relative;width:297mm;height:210mm;overflow:hidden;
  background:var(--ink);page-break-after:always;break-after:page;
}
.page:last-child{page-break-after:auto;break-after:auto}

.label{
  font-size:6.6pt;font-weight:600;text-transform:uppercase;
  letter-spacing:.28em;color:var(--muted);
}

/* ---------------------------------------------------------- cover */
.page--cover{display:flex;flex-direction:column;justify-content:center;padding:var(--pad)}
.mark{position:absolute;top:var(--pad);left:var(--pad);width:16mm;height:auto;opacity:.9}
.mark--missing{position:absolute;top:var(--pad);left:var(--pad);width:16mm;height:16mm;border:.3mm solid var(--hair)}
.cover-body{padding-left:2mm}
.cover-label{color:var(--acid);margin-bottom:8mm}
.cover-title{
  font-weight:800;font-size:34pt;line-height:.9;letter-spacing:-0.035em;
}
.cover-title .x{color:var(--acid);padding-left:.18em}
.cover-foot{
  position:absolute;left:var(--pad);right:var(--pad);bottom:var(--pad);
  display:flex;justify-content:space-between;align-items:baseline;
  border-top:.3mm solid var(--hair);padding-top:4mm;
}
.proof{
  position:absolute;right:var(--pad);top:var(--pad);width:78mm;
  border:.3mm solid var(--acid);padding:5mm;
}
.proof .label{color:var(--acid)}
.proof-body{margin-top:3mm;font-size:8pt;line-height:1.5;color:var(--muted)}

/* -------------------------------------------------------- section */
/* Copy hangs off the left rule; the plate escapes to the right edge. */
.page--section{display:grid;grid-template-columns:74mm 1fr;gap:10mm;padding:var(--pad) 0 var(--pad) var(--pad)}
.copy{display:flex;flex-direction:column;padding-top:2mm}
.num{color:var(--acid)}
.eyebrow{margin-top:2mm}
.title{
  margin-top:6mm;font-weight:800;font-size:19pt;line-height:.94;
  letter-spacing:-0.035em;
}
.caption{
  margin-top:6mm;padding-top:5mm;border-top:.3mm solid var(--hair);
  font-size:8.6pt;line-height:1.55;color:var(--muted);
}

.plate{
  display:flex;align-items:center;justify-content:flex-start;
  height:100%;overflow:hidden;
}
.plate--row{gap:5mm}
.frame{display:flex;flex-direction:column;min-width:0}
.frame img{
  display:block;width:100%;height:auto;
  border:.3mm solid var(--hair);
  /* Hairlines, never a drop shadow. */
}
.frame-note{margin-top:3mm;font-size:6.6pt;font-weight:600;text-transform:uppercase;
  letter-spacing:.28em;color:var(--muted)}

/* A single wide screenshot runs off the right edge of the sheet. */
.plate--single .frame{width:230mm}
.plate--single.plate--half .frame{width:196mm}

/* Three desktop frames across. */
.plate--row.plate--third .frame{width:66mm}
/* Two stills of the same page, side by side. */
.plate--row.plate--half .frame{width:97mm}
/* Phones and the vertical draw keep their real proportions. */
.plate--row.plate--phone .frame{width:52mm}
.plate--row.plate--vertical .frame{width:56mm}

.pending{align-self:stretch;justify-content:center}
.pending-box{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3mm;border:.3mm dashed var(--hair);background:var(--surface);
  aspect-ratio:16/10;width:100%;
}
.plate--row.plate--phone .pending-box,
.plate--row.plate--vertical .pending-box{aspect-ratio:9/16}
.pending-id{font-size:7pt;color:var(--muted);letter-spacing:.04em}
`;

async function main() {
  const allFrames = SHOTS.flatMap((s) => s.frames);
  const pending = [];
  for (const f of allFrames) {
    if (!(await frameSrc(f.id))) pending.push(f.id);
  }

  const pages = [await coverPage(pending)];
  for (const shot of SHOTS) pages.push(await sectionPage(shot));

  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${await fontFace()}${CSS}</style></head>
<body>${pages.join("")}</body></html>`;

  await mkdir(SCRATCH, { recursive: true });
  const htmlPath = path.join(SCRATCH, "walkthrough.html");
  await writeFile(htmlPath, html);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await mkdir(path.dirname(OUT), { recursive: true });
  await page.pdf({
    path: OUT,
    width: "297mm",
    height: "210mm",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await browser.close();

  console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`);
  console.log(`${pages.length} pages, ${allFrames.length - pending.length}/${allFrames.length} frames real`);
  if (pending.length) {
    console.log(`\nPENDING — the document is marked as a layout proof:\n  ${pending.join("\n  ")}`);
    console.log(`\nCapture them with:\n  BASE_URL=https://your-preview node scripts/walkthrough/capture.mjs`);
  }
}

await main();
