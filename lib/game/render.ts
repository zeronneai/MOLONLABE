import { drawAlien } from "./sprites";
import { drawPixelText, textWidthCells } from "./font";
import {
  ALIEN_COUNT,
  RIPPLE_TTL,
  alienPos,
  type GameState,
} from "./engine";

const INK = "#0b0a0c";
const BONE = "#f2efe7";
const MUTED = "#8a8b8f";
const ACID = "#57b94a";

const PROMPT = "DO YOU HAVE WHAT IT TAKES?";
const SUB_PROMPT = "HIT ALL FOUR";

export interface Pointer {
  x: number;
  y: number;
  /** last seen pointer type; crosshair only draws for mouse/pen */
  type: string;
  inside: boolean;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  pointer: Pointer,
): void {
  const { w, h, cell } = state;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);

  // Faint static starfield for depth
  ctx.fillStyle = BONE;
  ctx.globalAlpha = 0.12;
  for (const s of state.stars) {
    ctx.fillRect(Math.round(s.x * w), Math.round(s.y * h), s.size, s.size);
  }
  ctx.globalAlpha = 1;

  // Prompt, centered above the play area
  const promptCell = Math.max(
    2,
    Math.min(5, Math.floor((w * 0.86) / textWidthCells(PROMPT))),
  );
  const subCell = Math.max(2, promptCell - 1);
  const promptY = Math.max(24, h * 0.09);
  drawPixelText(ctx, PROMPT, w / 2, promptY, promptCell, BONE);
  drawPixelText(ctx, SUB_PROMPT, w / 2, promptY + 7 * promptCell + 14, subCell, MUTED);

  // Aliens
  for (const a of state.aliens) {
    if (!a.alive) continue;
    const pos = alienPos(state, a);
    drawAlien(ctx, pos.x, pos.y, cell);
  }

  // Burst particles, snapped to the pixel grid so they stay chunky
  const grain = Math.max(3, cell - 1);
  for (const p of state.particles) {
    ctx.globalAlpha = 1 - p.age / p.ttl;
    ctx.fillStyle = p.color;
    ctx.fillRect(
      Math.floor(p.x / grain) * grain,
      Math.floor(p.y / grain) * grain,
      grain,
      grain,
    );
  }
  ctx.globalAlpha = 1;

  // Tap ripples (touch feedback): expanding pixel-stepped square outlines
  for (const r of state.ripples) {
    const k = r.age / RIPPLE_TTL;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = ACID;
    drawSquareOutline(ctx, r.x, r.y, Math.floor((k * 44) / 4) * 4 + 8, 4);
  }
  ctx.globalAlpha = 1;

  // Counter, bottom left corner
  const counter = `${state.hits} / ${ALIEN_COUNT}`;
  const counterCell = 3;
  drawPixelText(
    ctx,
    counter,
    (textWidthCells(counter) * counterCell) / 2 + 20,
    h - 7 * counterCell - 20,
    counterCell,
    ACID,
  );

  // Crosshair reticle, fine pointers only
  if (pointer.inside && (pointer.type === "mouse" || pointer.type === "pen")) {
    drawCrosshair(ctx, pointer.x, pointer.y);
  }
}

function drawSquareOutline(
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

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  const u = 2; // reticle pixel unit
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = BONE;
  // Four arms with a gap around the center
  ctx.fillRect(px - u, py - 9 * u, 2 * u, 5 * u); // top
  ctx.fillRect(px - u, py + 4 * u, 2 * u, 5 * u); // bottom
  ctx.fillRect(px - 9 * u, py - u, 5 * u, 2 * u); // left
  ctx.fillRect(px + 4 * u, py - u, 5 * u, 2 * u); // right
  // Corner ticks
  ctx.fillRect(px - 9 * u, py - 9 * u, 3 * u, u);
  ctx.fillRect(px - 9 * u, py - 9 * u, u, 3 * u);
  ctx.fillRect(px + 6 * u, py - 9 * u, 3 * u, u);
  ctx.fillRect(px + 8 * u, py - 9 * u, u, 3 * u);
  ctx.fillRect(px - 9 * u, py + 8 * u, 3 * u, u);
  ctx.fillRect(px - 9 * u, py + 6 * u, u, 3 * u);
  ctx.fillRect(px + 6 * u, py + 8 * u, 3 * u, u);
  ctx.fillRect(px + 8 * u, py + 6 * u, u, 3 * u);
  // Center dot
  ctx.fillStyle = ACID;
  ctx.fillRect(px - u, py - u, 2 * u, 2 * u);
}
