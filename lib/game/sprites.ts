// Pixel sprites, drawn cell by cell so they stay chunky at any size.

// --- Alien head: G = green, D = dark green shade, B = black eye -----------

const ALIEN_MAP = [
  ".....GGGGG.....",
  "...GGGGGGGGG...",
  "..GGGGGGGGGGG..",
  ".GGGGGGGGGGGGG.",
  ".GGGGGGGGGGGGG.",
  "GGGGGGGGGGGGGGG",
  "GGBBBGGGGGBBBGG",
  "GBBBBBGGGBBBBBG",
  "GGBBBBBGBBBBBGG",
  "GGGBBBBGBBBBGGG",
  ".GGGGBBGBBGGGG.",
  ".GGGGGGGGGGGGG.",
  "..DGGGGGGGGGD..",
  "...DGGGGGGGD...",
  "....DGGGGGD....",
  "......DDD......",
];

export const ALIEN_COLS = ALIEN_MAP[0].length;
export const ALIEN_ROWS = ALIEN_MAP.length;

const ALIEN_COLORS: Record<string, string> = {
  G: "#57b94a",
  D: "#2e5f28",
  B: "#0b0a0c",
};

export const BURST_COLORS = ["#57b94a", "#57b94a", "#2e5f28", "#0b0a0c", "#f2efe7"];

/** Draw the alien centered on (cx, cy). `cell` is the size of one sprite pixel. */
export function drawAlien(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
): void {
  const originX = Math.round(cx - (ALIEN_COLS * cell) / 2);
  const originY = Math.round(cy - (ALIEN_ROWS * cell) / 2);
  for (let row = 0; row < ALIEN_ROWS; row++) {
    for (let col = 0; col < ALIEN_COLS; col++) {
      const color = ALIEN_COLORS[ALIEN_MAP[row][col]];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(originX + col * cell, originY + row * cell, cell, cell);
      }
    }
  }
}

// --- First-person pistol: tapered slide, two-hand grip silhouette ---------
// D = dark steel, S = slide, L = highlight, G = grip/hands, A = acid sight

const PISTOL_MAP = [
  ".......DSASD.......",
  ".......DSSSD.......",
  "......DSSSSSD......",
  "......DSSSSSD......",
  ".....DSSLLLSSD.....",
  ".....DSSLLLSSD.....",
  "....DSSSLLLSSSD....",
  "....DSSSSSSSSSD....",
  "...DDSSSSSSSSSDD...",
  "...DSSDDDDDDDSSD...",
  "..DDGGGDDDDDGGGDD..",
  "..DGGGGGDDDGGGGGD..",
  ".DGGGGGGGDGGGGGGGD.",
  ".DGGGGGGGDGGGGGGGD.",
  "DGGGGGGGGDGGGGGGGGD",
  "DGGGGGGGGDGGGGGGGGD",
];

export const PISTOL_COLS = PISTOL_MAP[0].length;
export const PISTOL_ROWS = PISTOL_MAP.length;

const PISTOL_COLORS: Record<string, string> = {
  D: "#101215",
  S: "#3a4048",
  L: "#565d67",
  G: "#272b31",
  A: "#57b94a",
};

/** Draw the pistol with its top-center at (cx, topY). */
export function drawPistol(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  cell: number,
): void {
  const originX = Math.round(cx - (PISTOL_COLS * cell) / 2);
  const originY = Math.round(topY);
  for (let row = 0; row < PISTOL_ROWS; row++) {
    for (let col = 0; col < PISTOL_COLS; col++) {
      const color = PISTOL_COLORS[PISTOL_MAP[row][col]];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(originX + col * cell, originY + row * cell, cell, cell);
      }
    }
  }
}

/** Muzzle flash above the pistol. `phase` 0..1, two frames. */
export function drawMuzzleFlash(
  ctx: CanvasRenderingContext2D,
  cx: number,
  muzzleY: number,
  cell: number,
  phase: number,
): void {
  const big = phase > 0.5;
  const u = cell * (big ? 1.4 : 0.9);
  const color = big ? "#f2efe7" : "#57b94a";
  ctx.fillStyle = color;
  // four-armed star
  ctx.fillRect(Math.round(cx - u / 2), Math.round(muzzleY - u * 3), u, u * 3);
  ctx.fillRect(Math.round(cx - u * 2.2), Math.round(muzzleY - u * 1.6), u * 4.4, u);
  ctx.fillRect(Math.round(cx - u * 1.4), Math.round(muzzleY - u * 2.4), u * 0.8, u * 0.8);
  ctx.fillRect(Math.round(cx + u * 0.6), Math.round(muzzleY - u * 2.4), u * 0.8, u * 0.8);
}
