// Scene assembly over the photographed backgrounds: loads assets, builds
// tinted sprite variants, and maps normalized anchors/occluders into
// viewport pixels. Occluders are regions of the background re-cropped and
// drawn on top of the aliens so rise-mode spawns emerge from behind cover.

import {
  ASSET_LOAD_TIMEOUT_MS,
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
  alien1: HTMLImageElement;
  alien2: HTMLImageElement;
  alien3: HTMLImageElement;
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

/** Preload everything for one orientation. Rejects → the game is skipped. */
export async function loadGameArt(portrait: boolean): Promise<GameArt> {
  const [bg, alien1, alien2, alien3, pistol] = await Promise.all([
    loadImage(portrait ? GAME_ASSETS.bgMobile : GAME_ASSETS.bgDesktop),
    loadImage(GAME_ASSETS.alien1),
    loadImage(GAME_ASSETS.alien2),
    loadImage(GAME_ASSETS.alien3),
    loadImage(GAME_ASSETS.pistol),
  ]);
  return { bg, portrait, alien1, alien2, alien3, pistol };
}

/** Load just the other orientation's background (device rotated mid-game). */
export async function loadBackground(portrait: boolean): Promise<HTMLImageElement> {
  return loadImage(portrait ? GAME_ASSETS.bgMobile : GAME_ASSETS.bgDesktop);
}

/** Darker + cooler variant for distant aliens so depth reads. */
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

export function buildScene(art: GameArt, w: number, h: number): Scene {
  const anchors = art.portrait ? SPAWN_ANCHORS_MOBILE : SPAWN_ANCHORS_DESKTOP;
  const bgDraw = coverFit(art.bg, w, h);

  const sources = { "1": art.alien1, "2": art.alien2, "3": art.alien3 } as const;
  const spawnPoints: SpawnPoint[] = anchors.map((anchor) => {
    const source = sources[anchor.sprite];
    const aspect = source.naturalHeight / Math.max(1, source.naturalWidth);
    const width = Math.min(w, h) * 0.24 * anchor.scale;
    return {
      x: anchor.x * w,
      coverY: anchor.y * h,
      w: width,
      h: width * aspect,
      sprite: tintSprite(source, anchor.tint),
      anchor,
    };
  });

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

  // open (pop) anchors have no occluder — clean-edged sprites don't need one
  const occluders: Occluder[] = anchors.flatMap((anchor) => {
    if (!anchor.occluder) return [];
    const dx = anchor.occluder.x * w;
    const dy = anchor.occluder.y * h;
    const dw = anchor.occluder.w * w;
    const dh = anchor.occluder.h * h;
    return [{ ...toSource(dx, dy, dw, dh), dx, dy, dw, dh, layer: anchor.occluder.layer }];
  });

  return { art, bgDraw, spawnPoints, occluders };
}
