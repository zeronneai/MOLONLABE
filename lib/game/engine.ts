import { ALIEN_COLS, ALIEN_ROWS, BURST_COLORS } from "./sprites";

export const ALIEN_COUNT = 4;
export const STEP = 1 / 120; // fixed timestep, seconds
const GRAVITY = 340;
const RIPPLE_TTL = 0.45;

export interface Alien {
  bx: number; // base position; sine drift is applied on top
  by: number;
  vx: number;
  vy: number;
  phase: number;
  freq: number;
  amp: number;
  alive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  color: string;
}

export interface Ripple {
  x: number;
  y: number;
  age: number;
}

export interface GameState {
  w: number;
  h: number;
  cell: number; // size of one sprite pixel, px
  t: number;
  hits: number;
  aliens: Alien[];
  particles: Particle[];
  ripples: Ripple[];
  stars: { x: number; y: number; size: number }[]; // normalized 0..1 coords
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function cellSize(w: number, h: number): number {
  return Math.max(3, Math.min(7, Math.floor(Math.min(w, h) / 90)));
}

export function createGame(w: number, h: number): GameState {
  const cell = cellSize(w, h);
  // One alien per quadrant so they start spread out.
  const quads = [
    [0.25, 0.4],
    [0.75, 0.35],
    [0.3, 0.72],
    [0.7, 0.68],
  ];
  const aliens: Alien[] = quads.map(([qx, qy]) => ({
    bx: w * qx + rand(-w * 0.06, w * 0.06),
    by: h * qy + rand(-h * 0.04, h * 0.04),
    vx: rand(45, 95) * (Math.random() < 0.5 ? -1 : 1),
    vy: rand(18, 40) * (Math.random() < 0.5 ? -1 : 1),
    phase: rand(0, Math.PI * 2),
    freq: rand(0.9, 2.1),
    amp: rand(18, 52),
    alive: true,
  }));
  const stars = Array.from({ length: 44 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() < 0.25 ? 3 : 2,
  }));
  return { w, h, cell, t: 0, hits: 0, aliens, particles: [], ripples: [], stars };
}

export function resizeGame(state: GameState, w: number, h: number): void {
  state.w = w;
  state.h = h;
  state.cell = cellSize(w, h);
  for (const a of state.aliens) {
    a.bx = Math.min(Math.max(a.bx, 0), w);
    a.by = Math.min(Math.max(a.by, 0), h);
  }
}

export function alienPos(state: GameState, a: Alien): { x: number; y: number } {
  return {
    x: a.bx + Math.sin(state.t * a.freq * 0.7 + a.phase) * a.amp * 0.5,
    y: a.by + Math.sin(state.t * a.freq + a.phase) * a.amp,
  };
}

export function update(state: GameState, dt: number): void {
  state.t += dt;

  const halfW = (ALIEN_COLS * state.cell) / 2;
  const halfH = (ALIEN_ROWS * state.cell) / 2;
  for (const a of state.aliens) {
    if (!a.alive) continue;
    a.bx += a.vx * dt;
    a.by += a.vy * dt;
    // Bounce the base point, leaving room for the sine drift on top.
    const minX = halfW + a.amp * 0.5;
    const maxX = state.w - minX;
    const minY = halfH + a.amp + 90; // keep clear of the prompt text
    const maxY = state.h - halfH - a.amp;
    if (a.bx < minX) { a.bx = minX; a.vx = Math.abs(a.vx); }
    if (a.bx > maxX) { a.bx = maxX; a.vx = -Math.abs(a.vx); }
    if (a.by < minY) { a.by = minY; a.vy = Math.abs(a.vy); }
    if (a.by > maxY) { a.by = maxY; a.vy = -Math.abs(a.vy); }
  }

  for (const p of state.particles) {
    p.age += dt;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.age < p.ttl);

  for (const r of state.ripples) r.age += dt;
  state.ripples = state.ripples.filter((r) => r.age < RIPPLE_TTL);
}

/** Returns the index of the alien under (x, y), or -1. */
export function hitTest(
  state: GameState,
  x: number,
  y: number,
  coarse: boolean,
): number {
  // Roughly 40% larger hit boxes on coarse pointers.
  const grow = coarse ? 1.4 : 1;
  const halfW = ((ALIEN_COLS * state.cell) / 2) * grow;
  const halfH = ((ALIEN_ROWS * state.cell) / 2) * grow;
  for (let i = 0; i < state.aliens.length; i++) {
    const a = state.aliens[i];
    if (!a.alive) continue;
    const pos = alienPos(state, a);
    if (Math.abs(x - pos.x) <= halfW && Math.abs(y - pos.y) <= halfH) return i;
  }
  return -1;
}

/** Kill an alien: mark it dead, bump the counter, scatter pixel particles. */
export function killAlien(state: GameState, index: number): void {
  const a = state.aliens[index];
  if (!a.alive) return;
  a.alive = false;
  state.hits += 1;
  const pos = alienPos(state, a);
  for (let i = 0; i < 30; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(70, 300);
    state.particles.push({
      x: pos.x + rand(-8, 8),
      y: pos.y + rand(-8, 8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      age: 0,
      ttl: rand(0.45, 0.85),
      color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
    });
  }
}

export function addRipple(state: GameState, x: number, y: number): void {
  state.ripples.push({ x, y, age: 0 });
}

export { RIPPLE_TTL };
