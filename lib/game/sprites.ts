// Alien head sprite, drawn cell by cell so it is chunky at any size.
// G = green, D = dark green shade, B = black eye.

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

const COLORS: Record<string, string> = {
  G: "#57b94a",
  D: "#2e5f28",
  B: "#0b0a0c",
};

// Colors that hit particles scatter in, weighted toward the greens.
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
      const key = ALIEN_MAP[row][col];
      const color = COLORS[key];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(originX + col * cell, originY + row * cell, cell, cell);
      }
    }
  }
}
