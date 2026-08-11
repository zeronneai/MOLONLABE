// The shop interior, prerendered to two layers: `back` (ceiling, wall,
// racks — drawn behind the aliens) and `front` (display counter, crates —
// drawn in front, so aliens pop up from behind cover). Stylized and
// readable, not detailed.

import { drawPixelText } from "./font";

export interface SpawnPoint {
  x: number;
  coverY: number; // aliens rise from behind this line
  scale: number; // closer cover = bigger alien
}

export interface Scene {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  spawnPoints: SpawnPoint[];
}

const INK = "#0b0a0c";

function layer(w: number, h: number, dpr: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function crate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cw: number,
  chh: number,
): void {
  ctx.fillStyle = "#2b2317";
  ctx.fillRect(x, y, cw, chh);
  ctx.fillStyle = "#3d3423";
  ctx.fillRect(x, y, cw, 2);
  ctx.fillRect(x, y, 2, chh);
  ctx.fillStyle = "#191510";
  ctx.fillRect(x + cw - 2, y, 2, chh);
  ctx.fillRect(x, y + chh - 2, cw, 2);
  // diagonal brace, stepped
  ctx.fillStyle = "#221b12";
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    ctx.fillRect(
      x + 3 + ((cw - 8) / steps) * i,
      y + 3 + ((chh - 8) / steps) * i,
      3,
      3,
    );
  }
}

export function buildScene(w: number, h: number, cell: number, dpr: number): Scene {
  const c = cell;
  const ceilingH = h * 0.16;
  const counterTop = h * 0.55;
  const counterBottom = h * 0.72;

  // ---- back layer ---------------------------------------------------------
  const b = layer(w, h, dpr);
  const bg = b.ctx;

  // wall
  bg.fillStyle = "#14161a";
  bg.fillRect(0, 0, w, h);

  // drop ceiling with tile grid and two light panels
  bg.fillStyle = "#101113";
  bg.fillRect(0, 0, w, ceilingH);
  bg.fillStyle = INK;
  for (let x = 0; x < w; x += c * 10) bg.fillRect(Math.round(x), 0, 1, ceilingH);
  for (let y = c * 5; y < ceilingH; y += c * 5) bg.fillRect(0, Math.round(y), w, 1);
  for (const lx of [0.24, 0.62]) {
    bg.fillStyle = "rgba(242,239,231,0.16)";
    bg.fillRect(Math.round(w * lx), Math.round(ceilingH * 0.35), c * 14, c * 1.6);
    bg.fillStyle = "rgba(242,239,231,0.05)";
    bg.fillRect(Math.round(w * lx) - c, Math.round(ceilingH * 0.35) + c * 1.6, c * 16, c);
  }

  // wall racks, left: two rails of rifle silhouettes
  bg.fillStyle = "#0d0e10";
  for (const railY of [h * 0.26, h * 0.37]) {
    bg.fillRect(Math.round(w * 0.05), Math.round(railY), Math.round(w * 0.42), 2);
    for (let i = 0; i < 4; i++) {
      const gx = w * 0.07 + i * w * 0.1;
      // rifle silhouette: barrel bar + stock + magazine nub
      bg.fillRect(Math.round(gx), Math.round(railY - c * 2.2), Math.round(c * 8), Math.round(c * 1.1));
      bg.fillRect(Math.round(gx + c * 6), Math.round(railY - c * 3), Math.round(c * 2), Math.round(c * 1.2));
      bg.fillRect(Math.round(gx + c * 3), Math.round(railY - c * 1.2), Math.round(c * 1.2), Math.round(c * 1.6));
    }
  }

  // pegboard, right, with hanging items
  bg.fillStyle = "#171a1e";
  bg.fillRect(Math.round(w * 0.56), Math.round(h * 0.22), Math.round(w * 0.38), Math.round(h * 0.24));
  bg.fillStyle = "rgba(138,139,143,0.18)";
  for (let px = w * 0.58; px < w * 0.92; px += c * 4) {
    for (let py = h * 0.24; py < h * 0.44; py += c * 4) {
      bg.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
  }
  bg.fillStyle = "#0d0e10";
  bg.fillRect(Math.round(w * 0.6), Math.round(h * 0.26), Math.round(c * 5), Math.round(c * 7)); // holster
  bg.fillRect(Math.round(w * 0.7), Math.round(h * 0.27), Math.round(c * 7), Math.round(c * 3)); // case
  bg.fillRect(Math.round(w * 0.82), Math.round(h * 0.26), Math.round(c * 3), Math.round(c * 8)); // sling

  // small shop sign over the pegboard
  const signX = w * 0.75;
  const signY = h * 0.17;
  bg.fillStyle = INK;
  bg.fillRect(Math.round(signX - c * 6), Math.round(signY), Math.round(c * 12), Math.round(c * 4.4));
  bg.strokeStyle = "#2e5f28";
  bg.lineWidth = 1;
  bg.strokeRect(Math.round(signX - c * 6) + 0.5, Math.round(signY) + 0.5, Math.round(c * 12) - 1, Math.round(c * 4.4) - 1);
  drawPixelText(bg, "MLF", signX, signY + c * 0.9, Math.max(1, Math.floor(c * 0.45)), "#57b94a");

  // floor
  bg.fillStyle = "#0d0e10";
  bg.fillRect(0, Math.round(counterBottom), w, h - counterBottom);
  bg.fillStyle = "rgba(242,239,231,0.03)";
  for (let i = 0; i < 4; i++) {
    bg.fillRect(0, Math.round(counterBottom + ((h - counterBottom) / 4) * i), w, 1);
  }

  // ---- front layer (cover the aliens hide behind) -------------------------
  const f = layer(w, h, dpr);
  const fg = f.ctx;

  // display counter: top edge, glass front with highlight strips, base
  fg.fillStyle = "#23262b";
  fg.fillRect(0, Math.round(counterTop), w, Math.round(c * 2));
  fg.fillStyle = "rgba(242,239,231,0.25)";
  fg.fillRect(0, Math.round(counterTop), w, 1);
  fg.fillStyle = "#1a1f24";
  fg.fillRect(0, Math.round(counterTop + c * 2), w, Math.round(counterBottom - counterTop - c * 2));
  fg.fillStyle = "rgba(242,239,231,0.06)";
  for (let gx = c * 3; gx < w; gx += c * 12) {
    fg.fillRect(Math.round(gx), Math.round(counterTop + c * 2.5), Math.round(c * 1.2), Math.round(counterBottom - counterTop - c * 4));
  }
  // faint merchandise blocks inside the glass
  fg.fillStyle = "rgba(11,10,12,0.55)";
  for (let gx = c * 6; gx < w - c * 8; gx += c * 16) {
    fg.fillRect(Math.round(gx), Math.round(counterTop + c * 4), Math.round(c * 7), Math.round(c * 2.4));
  }
  fg.fillStyle = "#101214";
  fg.fillRect(0, Math.round(counterBottom - c), w, Math.round(c));

  // crate stacks, left and right foreground
  const crateW = c * 15;
  const crateH = c * 10;
  const leftX = w * 0.03;
  const leftTop = h * 0.62;
  crate(fg, Math.round(leftX), Math.round(leftTop + crateH), Math.round(crateW), Math.round(crateH));
  crate(fg, Math.round(leftX + c), Math.round(leftTop), Math.round(crateW), Math.round(crateH));

  const rightX = w * 0.97 - crateW;
  const rightTop = h * 0.6;
  crate(fg, Math.round(rightX), Math.round(rightTop + crateH * 2), Math.round(crateW), Math.round(crateH));
  crate(fg, Math.round(rightX - c), Math.round(rightTop + crateH), Math.round(crateW), Math.round(crateH));
  crate(fg, Math.round(rightX + c * 0.5), Math.round(rightTop), Math.round(crateW * 0.9), Math.round(crateH));

  // ---- spawn points -------------------------------------------------------
  const spawnPoints: SpawnPoint[] = [
    { x: w * 0.22, coverY: counterTop, scale: 1.0 },
    { x: w * 0.5, coverY: counterTop, scale: 1.0 },
    { x: w * 0.74, coverY: counterTop, scale: 1.0 },
    { x: leftX + crateW * 0.55, coverY: leftTop, scale: 1.18 },
    { x: rightX + crateW * 0.45, coverY: rightTop, scale: 1.28 },
  ];

  return { back: b.canvas, front: f.canvas, spawnPoints };
}
