// Whack-a-mole round engine. All times are seconds of simulated time, so
// pausing the animation loop pauses the round. Difficulty knobs live in
// config.ts — tune there, not here.

import {
  GO_MS,
  MAG_SIZE,
  READY_MS,
  RELOAD_MS,
  RISE_MS,
  ROUND_MS,
  type Tuning,
} from "./config";
import { ALIEN_COLS, ALIEN_ROWS, BURST_COLORS } from "./sprites";
import type { SpawnPoint } from "./scene";

export const STEP = 1 / 120; // fixed timestep, seconds

const GRAVITY = 340;
const RIPPLE_TTL = 0.45;

export type TargetState = "rising" | "up" | "ducking";

export interface Target {
  sp: number; // spawn point index
  state: TargetState;
  progress: number; // rise/duck progress 0..1
  upFor: number; // seconds this one stays up
  upTime: number; // time spent fully up
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

export type RoundPhase = "ready" | "playing" | "won" | "lost";
export type ShotResult = "hit" | "miss" | "reloading" | "blocked";

export interface ArcadeState {
  w: number;
  h: number;
  cell: number;
  tuning: Tuning;
  spawnPoints: SpawnPoint[];
  t: number;
  phase: RoundPhase;
  readyT: number;
  roundEndsAt: number;
  targets: Target[];
  nextSpawnAt: number;
  hits: number;
  shots: number;
  ammo: number;
  reloadUntil: number; // 0 = not reloading
  gun: { recoil: number; flashT: number };
  particles: Particle[];
  ripples: Ripple[];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function cellSize(w: number, h: number): number {
  return Math.max(3, Math.min(7, Math.floor(Math.min(w, h) / 110)));
}

export function createArcade(
  w: number,
  h: number,
  tuning: Tuning,
  spawnPoints: SpawnPoint[],
): ArcadeState {
  return {
    w,
    h,
    cell: cellSize(w, h),
    tuning,
    spawnPoints,
    t: 0,
    phase: "ready",
    readyT: 0,
    roundEndsAt: 0,
    targets: [],
    nextSpawnAt: 0,
    hits: 0,
    shots: 0,
    ammo: MAG_SIZE,
    reloadUntil: 0,
    gun: { recoil: 0, flashT: 0 },
    particles: [],
    ripples: [],
  };
}

export function resizeArcade(
  state: ArcadeState,
  w: number,
  h: number,
  spawnPoints: SpawnPoint[],
): void {
  state.w = w;
  state.h = h;
  state.cell = cellSize(w, h);
  state.spawnPoints = spawnPoints;
  state.targets = []; // spawn points moved; clear cleanly
}

export function roundRemaining(state: ArcadeState): number {
  return Math.max(0, state.roundEndsAt - state.t);
}

/** Interval between spawns, accelerating over the round. */
function spawnInterval(state: ArcadeState): number {
  const progress =
    1 - roundRemaining(state) / (ROUND_MS / 1000) || 0;
  const ms =
    state.tuning.spawnStartMs +
    (state.tuning.spawnEndMs - state.tuning.spawnStartMs) * Math.min(1, progress);
  return (ms / 1000) * rand(0.85, 1.15);
}

export function update(state: ArcadeState, dt: number): void {
  state.t += dt;

  if (state.phase === "ready") {
    state.readyT += dt;
    if (state.readyT >= (READY_MS + GO_MS) / 1000) {
      state.phase = "playing";
      state.roundEndsAt = state.t + ROUND_MS / 1000;
      state.nextSpawnAt = state.t + 0.25;
    }
  }

  if (state.phase === "playing") {
    // reload completes
    if (state.reloadUntil > 0 && state.t >= state.reloadUntil) {
      state.reloadUntil = 0;
      state.ammo = MAG_SIZE;
    }

    // spawns
    const upCount = state.targets.length;
    if (state.t >= state.nextSpawnAt && upCount < state.tuning.maxUp) {
      const used = new Set(state.targets.map((tg) => tg.sp));
      const free = state.spawnPoints
        .map((_, i) => i)
        .filter((i) => !used.has(i));
      if (free.length > 0) {
        state.targets.push({
          sp: free[Math.floor(Math.random() * free.length)],
          state: "rising",
          progress: 0,
          upFor: rand(state.tuning.popMinMs, state.tuning.popMaxMs) / 1000,
          upTime: 0,
        });
      }
      state.nextSpawnAt = state.t + spawnInterval(state);
    }

    // target lifecycle
    const riseS = RISE_MS / 1000;
    for (const target of state.targets) {
      if (target.state === "rising") {
        target.progress += dt / riseS;
        if (target.progress >= 1) {
          target.progress = 1;
          target.state = "up";
        }
      } else if (target.state === "up") {
        target.upTime += dt;
        if (target.upTime >= target.upFor) target.state = "ducking";
      } else {
        target.progress -= dt / riseS;
      }
    }
    state.targets = state.targets.filter(
      (tg) => !(tg.state === "ducking" && tg.progress <= 0),
    );

    // round timer
    if (roundRemaining(state) <= 0) {
      state.phase = state.hits >= state.tuning.targetCount ? "won" : "lost";
      state.targets = [];
    }
  }

  // gun animation
  state.gun.recoil = Math.max(0, state.gun.recoil - dt * 7);
  state.gun.flashT = Math.max(0, state.gun.flashT - dt);

  // particles
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

/** How far up a target currently is, 0..1. */
export function riseProgress(target: Target): number {
  return Math.max(0, Math.min(1, target.progress));
}

/** Alien center position for a target, in CSS px. */
export function targetCenter(
  state: ArcadeState,
  target: Target,
): { x: number; y: number; w: number; h: number } {
  const sp = state.spawnPoints[target.sp];
  const cw = ALIEN_COLS * state.cell * sp.scale;
  const chh = ALIEN_ROWS * state.cell * sp.scale;
  const rise = riseProgress(target);
  return { x: sp.x, y: sp.coverY - chh * rise + chh / 2, w: cw, h: chh };
}

export function fire(state: ArcadeState, x: number, y: number): ShotResult {
  if (state.phase !== "playing") return "blocked";
  if (state.reloadUntil > 0) return "reloading";

  state.ammo -= 1;
  state.shots += 1;
  state.gun.recoil = 1;
  state.gun.flashT = 0.09;

  let result: ShotResult = "miss";
  const grow = state.tuning.hitboxGrow;
  for (const target of state.targets) {
    if (target.state === "ducking") continue;
    const box = targetCenter(state, target);
    const sp = state.spawnPoints[target.sp];
    const halfW = (box.w / 2) * grow;
    const topY = box.y - (box.h / 2) * grow;
    // hittable region: grown box, clipped at the cover line
    if (
      Math.abs(x - box.x) <= halfW &&
      y >= topY &&
      y <= sp.coverY + box.h * 0.1
    ) {
      burst(state, box.x, box.y - box.h * 0.1, sp.scale);
      target.state = "ducking";
      target.progress = 0; // vanishes; the burst sells the hit
      state.hits += 1;
      result = "hit";
      break;
    }
  }

  if (state.hits >= state.tuning.targetCount) {
    state.phase = "won";
    state.targets = [];
  } else if (state.ammo <= 0) {
    state.reloadUntil = state.t + RELOAD_MS / 1000;
  }
  return result;
}

function burst(state: ArcadeState, x: number, y: number, scale: number): void {
  for (let i = 0; i < 26; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(70, 300) * scale;
    state.particles.push({
      x: x + rand(-8, 8),
      y: y + rand(-8, 8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      age: 0,
      ttl: rand(0.4, 0.8),
      color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
    });
  }
}

export function addRipple(state: ArcadeState, x: number, y: number): void {
  state.ripples.push({ x, y, age: 0 });
}

export { RIPPLE_TTL };
