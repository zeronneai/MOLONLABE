// Scene assembly over the photographed backgrounds: loads assets, builds
// tinted sprite variants, and maps normalized anchors/occluders into
// viewport pixels. Occluders are regions of the background re-cropped and
// drawn on top of the targets so rise-mode spawns emerge from behind cover.

import {
  ASSET_LOAD_TIMEOUT_MS,
  BACKDROP,
  GAME_ASSETS,
  PARALLAX,
  SPAWN_ANCHORS_DESKTOP,
  SPAWN_ANCHORS_MOBILE,
  type SpawnAnchor,
} from "./assets";

export interface SpawnPoint {
  x: number;
  coverY: number;
  w: number;
  h: number;
  sprite: CanvasImageSource;
  anchor: SpawnAnchor;
  /**
   * How much dark halo this point needs, 0..1, measured from the actual
   * background rather than guessed. A small target over a lit display case
   * would otherwise disappear, and which points land on a lit case is a
   * property of the photograph, not of the code.
   */
  drop: number;
}

export interface Occluder {
  // source rect in background-image pixels, destination rect in viewport px
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  layer: "bg" | "fg";
}

export interface GameArt {
  bg: HTMLImageElement;
  portrait: boolean;
  target: HTMLImageElement;
  pistol: HTMLImageElement;
}

export interface Scene {
  art: GameArt;
  // cover-fit mapping of the background into the viewport (before overscan)
  bgDraw: { dx: number; dy: number; dw: number; dh: number };
  spawnPoints: SpawnPoint[];
  occluders: Occluder[];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(
      () => reject(new Error(`asset timeout: ${src}`)),
      ASSET_LOAD_TIMEOUT_MS,
    );
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`asset failed: ${src}`));
    };
    img.src = src;
  });
}

/**
 * Is the target sprite actually cut out?
 *
 * The targets are drawn straight onto a photograph, so a sprite exported
 * with a solid background renders as a rectangle sitting on the shop
 * floor. That is obvious once you see it and invisible in code review, and
 * the asset lives on a CDN where it can be replaced without a deploy — so
 * the game checks rather than assumes.
 *
 * Returns null when the check could not run (a tainted canvas, a zero-size
 * image); a null is not a failure, just an unknown.
 */
export type CutoutReport = {
  clean: boolean;
  /** Fraction of the outer ring of pixels that is fully opaque. */
  opaqueEdge: number;
  /** Fraction of the whole image that is fully transparent. */
  transparent: number;
};

export function inspectCutout(img: HTMLImageElement): CutoutReport | null {
  try {
    const w = Math.min(160, img.naturalWidth);
    const h = Math.min(160, img.naturalHeight);
    if (w < 4 || h < 4) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    let edgeTotal = 0;
    let edgeOpaque = 0;
    let clear = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha < 8) clear++;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          edgeTotal++;
          if (alpha > 250) edgeOpaque++;
        }
      }
    }
    const opaqueEdge = edgeOpaque / Math.max(1, edgeTotal);
    const transparent = clear / Math.max(1, w * h);
    // A cut-out sprite is transparent around its edges. A flat export is
    // opaque all the way to the corners and has almost no clear pixels.
    return { clean: opaqueEdge < 0.5 && transparent > 0.05, opaqueEdge, transparent };
  } catch {
    return null;
  }
}

/** Preload everything for one orientation. Rejects → the game is skipped. */
export async function loadGameArt(portrait: boolean): Promise<GameArt> {
  const [bg, target, pistol] = await Promise.all([
    loadImage(portrait ? GAME_ASSETS.bgMobile : GAME_ASSETS.bgDesktop),
    loadImage(GAME_ASSETS.target),
    loadImage(GAME_ASSETS.pistol),
  ]);

  // Exposed in every environment so the asset can be checked against the
  // deployed site from a console, not just in development.
  const cutout = inspectCutout(target);
  (window as unknown as { __mlfTargetCutout?: CutoutReport | null }).__mlfTargetCutout =
    cutout;
  if (process.env.NODE_ENV !== "production" && cutout && !cutout.clean) {
    console.warn(
      "[intro game] The target sprite does not look cut out: " +
        `${Math.round(cutout.opaqueEdge * 100)}% of its outer edge is opaque and only ` +
        `${Math.round(cutout.transparent * 100)}% of it is transparent. It will render ` +
        "as a rectangle on the shop floor. Replace the asset with a PNG that has a " +
        "real alpha channel.",
    );
  }

  return { bg, portrait, target, pistol };
}

/** Load just the other orientation's background (device rotated mid-game). */
export async function loadBackground(portrait: boolean): Promise<HTMLImageElement> {
  return loadImage(portrait ? GAME_ASSETS.bgMobile : GAME_ASSETS.bgDesktop);
}

/** Darker + cooler variant for distant targets so depth reads. */
function tintSprite(img: HTMLImageElement, tint: number): CanvasImageSource {
  if (tint <= 0) return img;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = `rgba(16, 28, 48, ${Math.min(0.7, tint)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Cover-fit mapping with overscan so parallax never reveals an edge. */
function coverFit(img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * PARALLAX.overscan;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

/**
 * Mean perceived luminance (0..1) of a region of the background, sampled
 * from the decoded image. Cloudinary serves CORS headers and the image is
 * loaded crossOrigin=anonymous, so the canvas is not tainted; if a future
 * host stops sending them, getImageData throws and we fall back to the
 * anchor's own darkDrop flag.
 */
function sampleLuminance(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): number | null {
  try {
    const canvas = document.createElement("canvas");
    const size = 16; // enough to average a region, cheap to read back
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    // Clamp to the image so an anchor near the edge still samples something.
    const cx = Math.max(0, Math.min(img.naturalWidth - 1, sx));
    const cy = Math.max(0, Math.min(img.naturalHeight - 1, sy));
    const cw = Math.max(1, Math.min(img.naturalWidth - cx, sw));
    const ch = Math.max(1, Math.min(img.naturalHeight - cy, sh));
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
    return total / (data.length / 4);
  } catch {
    return null; // tainted canvas or a decode that never completed
  }
}

export function buildScene(art: GameArt, w: number, h: number): Scene {
  const anchors = art.portrait ? SPAWN_ANCHORS_MOBILE : SPAWN_ANCHORS_DESKTOP;
  const bgDraw = coverFit(art.bg, w, h);

  // viewport rect → background-image source rect (inverse of cover-fit)
  const toSource = (vx: number, vy: number, vw: number, vh: number) => {
    const scaleX = art.bg.naturalWidth / bgDraw.dw;
    const scaleY = art.bg.naturalHeight / bgDraw.dh;
    return {
      sx: (vx - bgDraw.dx) * scaleX,
      sy: (vy - bgDraw.dy) * scaleY,
      sw: vw * scaleX,
      sh: vh * scaleY,
    };
  };

  // One image behind all three depth slots. The slot still selects the
  // tint and the backdrop threshold; it no longer selects artwork.
  const sources = { "1": art.target, "2": art.target, "3": art.target } as const;
  const spawnPoints: SpawnPoint[] = anchors.map((anchor) => {
    const source = sources[anchor.sprite];
    const aspect = source.naturalHeight / Math.max(1, source.naturalWidth);
    const width = Math.min(w, h) * 0.24 * anchor.scale;
    // Sample what is actually behind this point, over the box the target
    // occupies when fully up.
    const height = width * aspect;
    const region = toSource(anchor.x * w - width / 2, anchor.y * h - height, width, height);
    const luma = sampleLuminance(art.bg, region.sx, region.sy, region.sw, region.sh);

    // Distant points need help sooner: they render small, so they lose
    // against a lit case at a lower background luminance. Below the
    // threshold the background is doing the work already and a halo would
    // just look like a smudge.
    const threshold = anchor.sprite === "3" ? BACKDROP.paleThreshold : BACKDROP.darkThreshold;
    const measured =
      luma === null
        ? anchor.darkDrop
          ? BACKDROP.maxDrop
          : 0
        : Math.max(0, Math.min(1, (luma - threshold) / (1 - threshold))) * BACKDROP.maxDrop;

    return {
      x: anchor.x * w,
      coverY: anchor.y * h,
      w: width,
      h: height,
      sprite: tintSprite(source, anchor.tint),
      anchor,
      // The hand-set flag is a floor, not the whole answer: measurement can
      // ask for more, never for less.
      drop: Math.max(measured, anchor.darkDrop ? BACKDROP.minFlagged : 0),
    };
  });

  // open (pop) anchors have no occluder — clean-edged sprites don't need one
  const occluders: Occluder[] = anchors.flatMap((anchor) => {
    if (!anchor.occluder) return [];
    const dx = anchor.occluder.x * w;
    const dy = anchor.occluder.y * h;
    const dw = anchor.occluder.w * w;
    const dh = anchor.occluder.h * h;
    return [{ ...toSource(dx, dy, dw, dh), dx, dy, dw, dh, layer: anchor.occluder.layer }];
  });

  // Dev probe: lets a test assert what was measured without reading pixels
  // back out of a live canvas. Costs one array assignment per scene build.
  if (typeof window !== "undefined") {
    (window as unknown as { __mlfSpawnDrops?: unknown }).__mlfSpawnDrops =
      spawnPoints.map((sp) => ({ x: sp.anchor.x, sprite: sp.anchor.sprite, drop: sp.drop }));
  }

  return { art, bgDraw, spawnPoints, occluders };
}
