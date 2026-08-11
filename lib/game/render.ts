import { GO_MS, MAG_SIZE, READY_MS, RELOAD_MS } from "./config";
import { drawAlien, drawMuzzleFlash, drawPistol, PISTOL_COLS, PISTOL_ROWS } from "./sprites";
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

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: ArcadeState,
  scene: Scene,
  pointer: Pointer,
): void {
  const { w, h, cell } = state;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(scene.back, 0, 0, w, h);

  // aliens rise between the back and front layers
  for (const target of state.targets) {
    const sp = state.spawnPoints[target.sp];
    const box = targetCenter(state, target);
    if (riseProgress(target) > 0.01) {
      drawAlien(ctx, box.x, box.y, cell * sp.scale);
    }
  }

  ctx.drawImage(scene.front, 0, 0, w, h);

  // burst particles, snapped to the pixel grid
  const grain = Math.max(3, cell - 1);
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.age / p.ttl;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x / grain) * grain, Math.floor(p.y / grain) * grain, grain, grain);
  }
  ctx.globalAlpha = 1;

  // tap ripples
  for (const r of state.ripples) {
    const k = r.age / RIPPLE_TTL;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = ACID;
    squareOutline(ctx, r.x, r.y, Math.floor((k * 44) / 4) * 4 + 8, 4);
  }
  ctx.globalAlpha = 1;

  drawGun(ctx, state);
  drawHud(ctx, state);

  if (pointer.inside && (pointer.type === "mouse" || pointer.type === "pen")) {
    drawCrosshair(ctx, pointer.x, pointer.y);
  }
}

// --- gun -------------------------------------------------------------------

function drawGun(ctx: CanvasRenderingContext2D, state: ArcadeState): void {
  const { w, h, cell } = state;
  const gc = cell * 1.7;
  const gunH = PISTOL_ROWS * gc;
  const cx = w / 2;

  // reload: gun dips down and comes back
  let reloadDip = 0;
  if (state.reloadUntil > 0) {
    const total = RELOAD_MS / 1000;
    const progress = 1 - (state.reloadUntil - state.t) / total;
    reloadDip = Math.sin(Math.PI * Math.min(1, Math.max(0, progress))) * gunH * 0.65;
  }
  const recoilKick = state.gun.recoil * cell * 3.5;
  const topY = h - gunH + recoilKick + reloadDip;

  drawPistol(ctx, cx, topY, gc);
  if (state.gun.flashT > 0) {
    drawMuzzleFlash(ctx, cx, topY - cell, cell, state.gun.flashT / 0.09);
  }

  if (state.reloadUntil > 0) {
    const total = RELOAD_MS / 1000;
    const progress = 1 - (state.reloadUntil - state.t) / total;
    const barW = PISTOL_COLS * gc * 0.9;
    const barY = h - gunH - cell * 6;
    drawPixelText(ctx, "RELOADING", cx, barY - cell * 4, Math.max(2, cell - 3), MUTED);
    ctx.fillStyle = "rgba(138,139,143,0.25)";
    ctx.fillRect(Math.round(cx - barW / 2), Math.round(barY), Math.round(barW), cell);
    ctx.fillStyle = ACID;
    ctx.fillRect(Math.round(cx - barW / 2), Math.round(barY), Math.round(barW * progress), cell);
  }
}

// --- HUD -------------------------------------------------------------------

function drawHud(ctx: CanvasRenderingContext2D, state: ArcadeState): void {
  const { w, h, cell, tuning } = state;

  if (state.phase === "ready") {
    const readyS = READY_MS / 1000;
    const label = state.readyT < readyS ? "READY" : "GO!";
    const scale = Math.max(4, cell + 1);
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

  // timer, top center — reads like a shot clock
  const remaining = roundRemaining(state);
  const timerText = remaining.toFixed(1);
  const timerScale = Math.max(3, cell - 1);
  const urgent = remaining < 3;
  drawPixelText(ctx, timerText, w / 2, cell * 4, timerScale, urgent ? DANGER : BONE);

  // hit counter, top left
  drawPixelText(
    ctx,
    `${state.hits} / ${tuning.targetCount}`,
    (textWidthCells(`${state.hits} / ${tuning.targetCount}`) * 3) / 2 + cell * 4,
    cell * 4,
    3,
    ACID,
  );

  // ammo pips, bottom left
  const pipW = cell * 2;
  const pipH = cell * 4;
  for (let i = 0; i < MAG_SIZE; i++) {
    const x = cell * 4 + i * pipW * 1.6;
    const y = h - pipH - cell * 4;
    if (i < state.ammo) {
      ctx.fillStyle = BONE;
      ctx.fillRect(Math.round(x), Math.round(y), pipW, pipH);
      ctx.fillStyle = ACID;
      ctx.fillRect(Math.round(x), Math.round(y), pipW, cell);
    } else {
      ctx.fillStyle = "rgba(138,139,143,0.3)";
      ctx.fillRect(Math.round(x), Math.round(y), pipW, 1);
      ctx.fillRect(Math.round(x), Math.round(y + pipH - 1), pipW, 1);
      ctx.fillRect(Math.round(x), Math.round(y), 1, pipH);
      ctx.fillRect(Math.round(x + pipW - 1), Math.round(y), 1, pipH);
    }
  }
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
