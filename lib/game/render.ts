// Frame renderer over the photographic scene. Order: background → targets
// → occluders (bg-speed patches, then the fg crate band) → pistol →
// muzzle bloom → HUD → vignette, chromatic fringe, grain → reticle.
// Desktop gets mouse-look parallax; mobile renders everything fixed.

import { GO_MS, READY_MS, RELOAD_MS } from "./config";
import { PARALLAX, PISTOL_LAYOUT } from "./assets";
import { drawPixelText, textWidthCells } from "./font";
import {
  RIPPLE_TTL,
  riseProgress,
  roundRemaining,
  targetCenter,
  type ArcadeState,
} from "./engine";
import type { Scene } from "./scene";

const INK = "#0b0a0c";
const BONE = "#f2efe7";
const MUTED = "#8a8b8f";
const ACID = "#57b94a";
const DANGER = "#c6472f";

export interface Pointer {
  x: number;
  y: number;
  type: string;
  inside: boolean;
}

export interface ViewFx {
  /** smoothed cursor offset from centre, px (0,0 on mobile) */
  lookX: number;
  lookY: number;
  parallax: boolean;
}

// prerendered overlays, rebuilt on resize
let fxCanvas: HTMLCanvasElement | null = null;
let fxKey = "";
let grainTile: HTMLCanvasElement | null = null;

function buildGrain(): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const ctx = tile.getContext("2d")!;
  const data = ctx.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 10; // light grain
  }
  ctx.putImageData(data, 0, 0);
  return tile;
}

/** Vignette + subtle chromatic fringe at the edges, prerendered. */
function buildFx(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const r = Math.hypot(w, h) / 2;

  const ring = (cx: number, cy: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, color.replace("A", String(alpha)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  // chromatic fringe: offset warm/cool rings under the vignette
  ring(w / 2 - 2, h / 2, "rgba(198,71,47,A)", 0.1);
  ring(w / 2 + 2, h / 2, "rgba(74,141,185,A)", 0.1);
  ring(w / 2, h / 2, "rgba(11,10,12,A)", 0.62);
  return canvas;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: ArcadeState,
  scene: Scene,
  pointer: Pointer,
  fx: ViewFx,
): void {
  const { w, h } = state;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";

  const bgOff = { x: fx.lookX * PARALLAX.bg, y: fx.lookY * PARALLAX.bg };
  const fgOff = { x: fx.lookX * PARALLAX.fg, y: fx.lookY * PARALLAX.fg };

  // screen shake follows recoil
  const shake = state.gun.recoil;
  const shakeX = shake > 0.02 ? (Math.random() - 0.5) * 7 * shake : 0;
  const shakeY = shake > 0.02 ? (Math.random() - 0.5) * 7 * shake : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // background
  ctx.fillStyle = INK;
  ctx.fillRect(-8, -8, w + 16, h + 16);
  const { dx, dy, dw, dh } = scene.bgDraw;
  ctx.drawImage(scene.art.bg, dx + bgOff.x, dy + bgOff.y, dw, dh);

  // targets (bg layer speed)
  for (const target of state.targets) {
    if (riseProgress(target) <= 0.01) continue;
    const sp = state.spawnPoints[target.sp];
    const box = targetCenter(state, target);
    const px = box.x + bgOff.x;
    const py = box.y + bgOff.y;
    // Soft dark halo so a pale sprite never dissolves into a lit case. Its
    // strength was measured from the background at scene build time.
    if (sp.drop > 0.01) {
      const r = box.w * 0.85;
      const halo = ctx.createRadialGradient(px, py, 0, px, py, r);
      halo.addColorStop(0, `rgba(11, 10, 12, ${sp.drop.toFixed(3)})`);
      halo.addColorStop(1, "rgba(11, 10, 12, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    ctx.save();
    if (target.flip) {
      ctx.translate(px, py);
      ctx.scale(-1, 1);
      ctx.drawImage(sp.sprite, -box.w / 2, -box.h / 2, box.w, box.h);
    } else {
      ctx.drawImage(sp.sprite, px - box.w / 2, py - box.h / 2, box.w, box.h);
    }
    ctx.restore();
  }

  // hit particles (bg layer)
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.age / p.ttl;
    ctx.fillStyle = p.color;
    const size = 5;
    ctx.fillRect(
      Math.floor((p.x + bgOff.x) / size) * size,
      Math.floor((p.y + bgOff.y) / size) * size,
      size,
      size,
    );
  }
  ctx.globalAlpha = 1;

  // occluders: re-cropped background regions the rise-mode targets emerge behind
  for (const oc of scene.occluders) {
    const off = oc.layer === "fg" ? fgOff : bgOff;
    ctx.drawImage(
      scene.art.bg,
      oc.sx,
      oc.sy,
      oc.sw,
      oc.sh,
      oc.dx + off.x,
      oc.dy + off.y,
      oc.dw,
      oc.dh,
    );
  }

  // tap ripples
  for (const r of state.ripples) {
    const k = r.age / RIPPLE_TTL;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = ACID;
    squareOutline(ctx, r.x, r.y, Math.floor((k * 44) / 4) * 4 + 8, 4);
  }
  ctx.globalAlpha = 1;

  drawPistolLayer(ctx, state, scene, fx);
  ctx.restore(); // end shake

  drawHud(ctx, state);

  // post: vignette + chromatic fringe, then drifting grain
  if (fxKey !== `${w}x${h}` || !fxCanvas) {
    fxCanvas = buildFx(w, h);
    fxKey = `${w}x${h}`;
  }
  ctx.drawImage(fxCanvas, 0, 0);
  grainTile ??= buildGrain();
  ctx.save();
  ctx.globalAlpha = 0.5;
  const gx = -Math.floor(Math.random() * 128);
  const gy = -Math.floor(Math.random() * 128);
  for (let ty = gy; ty < h; ty += 128) {
    for (let tx = gx; tx < w; tx += 128) {
      ctx.drawImage(grainTile, tx, ty);
    }
  }
  ctx.restore();

  if (pointer.inside && (pointer.type === "mouse" || pointer.type === "pen")) {
    drawCrosshair(ctx, pointer.x, pointer.y);
  }
}

// --- pistol ---------------------------------------------------------------

function drawPistolLayer(
  ctx: CanvasRenderingContext2D,
  state: ArcadeState,
  scene: Scene,
  fx: ViewFx,
): void {
  const { w, h } = state;
  const P = PISTOL_LAYOUT;
  const img = scene.art.pistol;

  const displayH = h * (scene.art.portrait ? P.heightFracMobile : P.heightFrac);
  const scale = displayH / Math.max(1, img.naturalHeight);
  const displayW = img.naturalWidth * scale;

  // reload dip
  let reloadDip = 0;
  let reloadProgress = 0;
  if (state.reloadUntil > 0) {
    reloadProgress = Math.min(
      1,
      Math.max(0, 1 - (state.reloadUntil - state.t) / (RELOAD_MS / 1000)),
    );
    reloadDip = Math.sin(Math.PI * reloadProgress) * displayH * 0.35;
  }

  const rotation =
    ((P.rotationDeg - state.gun.recoil * P.recoilTwistDeg) * Math.PI) / 180;
  // recoil pushes back along the barrel axis (down-right of the up-left barrel)
  const kick = state.gun.recoil * P.recoilKickPx;
  const kickX = -Math.sin(rotation) * kick;
  const kickY = Math.cos(rotation) * kick;

  const aimX = fx.parallax ? fx.lookX * P.aimShift : 0;
  const aimY = fx.parallax ? fx.lookY * P.aimShift * 0.6 : 0;

  const pivotX = w * P.anchorX + aimX + kickX;
  const pivotY = h + displayH * P.pivotBelow + aimY + kickY + reloadDip;

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(rotation);
  // pivot sits at the grip: horizontal centre, bottom of the sprite
  ctx.drawImage(img, -displayW / 2, -displayH, displayW, displayH);

  // muzzle bloom lights the scene on fire
  if (state.gun.flashT > 0) {
    const mx = -displayW / 2 + displayW * P.muzzle.x;
    const my = -displayH + displayH * P.muzzle.y;
    const strength = state.gun.flashT / 0.09;
    ctx.globalCompositeOperation = "lighter";
    const r = Math.min(w, h) * 0.5 * strength;
    const bloom = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    bloom.addColorStop(0, `rgba(255, 244, 214, ${0.85 * strength})`);
    bloom.addColorStop(0.25, `rgba(255, 214, 140, ${0.35 * strength})`);
    bloom.addColorStop(1, "rgba(255, 200, 120, 0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(mx - r, my - r, r * 2, r * 2);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();

  if (state.reloadUntil > 0) {
    const barW = Math.min(w * 0.32, 320);
    const barY = h - 40;
    const cx = w * 0.62;
    drawPixelText(ctx, "RELOADING", cx, barY - 26, 3, MUTED);
    ctx.fillStyle = "rgba(138,139,143,0.3)";
    ctx.fillRect(Math.round(cx - barW / 2), barY, barW, 5);
    ctx.fillStyle = ACID;
    ctx.fillRect(Math.round(cx - barW / 2), barY, Math.round(barW * reloadProgress), 5);
  }
}

// --- HUD ------------------------------------------------------------------

function drawHud(ctx: CanvasRenderingContext2D, state: ArcadeState): void {
  const { w, h, cell, tuning } = state;

  if (state.phase === "ready") {
    const label = state.readyT < READY_MS / 1000 ? "READY" : "GO!";
    const scale = Math.max(4, cell + 1);
    // backing strip keeps pixel text readable over the photo
    ctx.fillStyle = "rgba(11,10,12,0.55)";
    ctx.fillRect(0, h * 0.26, w, scale * 12 + 40);
    drawPixelText(ctx, label, w / 2, h * 0.3, scale, label === "GO!" ? ACID : BONE);
    drawPixelText(
      ctx,
      `HIT ${tuning.targetCount} BEFORE THE CLOCK`,
      w / 2,
      h * 0.3 + scale * 9,
      Math.max(2, cell - 3),
      MUTED,
    );
    return;
  }
  if (state.phase !== "playing") return;

  const remaining = roundRemaining(state);
  const urgent = remaining < 3;
  const timerScale = Math.max(3, cell - 1);
  shadowText(ctx, remaining.toFixed(1), w / 2, 22, timerScale, urgent ? DANGER : BONE);

  const counter = `${state.hits} / ${tuning.targetCount}`;
  shadowText(ctx, counter, (textWidthCells(counter) * 3) / 2 + 24, 22, 3, ACID);

  // ammo pips, bottom left
  const pipW = 9;
  const pipH = 20;
  for (let i = 0; i < state.tuning.magSize; i++) {
    const x = 24 + i * pipW * 1.7;
    const y = h - pipH - 24;
    if (i < state.ammo) {
      ctx.fillStyle = BONE;
      ctx.fillRect(x, y, pipW, pipH);
      ctx.fillStyle = ACID;
      ctx.fillRect(x, y, pipW, 5);
    } else {
      ctx.strokeStyle = "rgba(242,239,231,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, pipW - 1, pipH - 1);
    }
  }
}

function shadowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  topY: number,
  scale: number,
  color: string,
): void {
  drawPixelText(ctx, text, cx + 2, topY + 2, scale, "rgba(11,10,12,0.8)");
  drawPixelText(ctx, text, cx, topY, scale, color);
}

// --- reticle & ripple ------------------------------------------------------

function squareOutline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  half: number,
  thickness: number,
): void {
  const x = Math.round(cx - half);
  const y = Math.round(cy - half);
  const size = half * 2;
  ctx.fillRect(x, y, size, thickness);
  ctx.fillRect(x, y + size - thickness, size, thickness);
  ctx.fillRect(x, y, thickness, size);
  ctx.fillRect(x + size - thickness, y, thickness, size);
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const u = 2;
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = BONE;
  ctx.fillRect(px - u, py - 9 * u, 2 * u, 5 * u);
  ctx.fillRect(px - u, py + 4 * u, 2 * u, 5 * u);
  ctx.fillRect(px - 9 * u, py - u, 5 * u, 2 * u);
  ctx.fillRect(px + 4 * u, py - u, 5 * u, 2 * u);
  ctx.fillRect(px - 9 * u, py - 9 * u, 3 * u, u);
  ctx.fillRect(px - 9 * u, py - 9 * u, u, 3 * u);
  ctx.fillRect(px + 6 * u, py - 9 * u, 3 * u, u);
  ctx.fillRect(px + 8 * u, py - 9 * u, u, 3 * u);
  ctx.fillRect(px - 9 * u, py + 8 * u, 3 * u, u);
  ctx.fillRect(px - 9 * u, py + 6 * u, u, 3 * u);
  ctx.fillRect(px + 6 * u, py + 8 * u, 3 * u, u);
  ctx.fillRect(px + 8 * u, py + 6 * u, u, 3 * u);
  ctx.fillStyle = ACID;
  ctx.fillRect(px - u, py - u, 2 * u, 2 * u);
}
