// ---------------------------------------------------------------------------
// Game art assets and composition tuning. Every knob for placing things
// against the photographed backgrounds lives HERE — never inline URLs or
// magic positions elsewhere.
// ---------------------------------------------------------------------------

const cld = (url: string, width: number) =>
  url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);

// Budget: backgrounds ≤2000px wide, sprites ≤900px, total transfer <700KB.
// Only one background loads per session (picked by orientation).
export const GAME_ASSETS = {
  bgDesktop: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786484074/Firearms_showroom_interior_with___202608111530_rctfrd.jpg",
    2000,
  ),
  bgMobile: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786484199/Firearms_showroom_interior_with___202608111535_a42wut.jpg",
    1080,
  ),
  // chroma-cut sprites, clean edges, spill removed (~256KB all three)
  alien1: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786489222/alien-1_ox2itj.webp",
    900,
  ),
  alien2: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786489222/alien-2_rgk1wu.webp",
    900,
  ),
  alien3: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786489222/alien-3_rpqmel.webp",
    500, // the pale one; only ever renders small at the distant anchors
  ),
  pistol: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786484323/pistol_1_pqjirg.webp",
    900,
  ),
};

// --- Spawn anchors, normalized to the viewport -----------------------------
// x/y: where the alien stands; y is the cover line (or floor line for open
// points). scale: relative alien size (1 = near foreground).
// sprite: '1'/'2' are cooler and darker — near and mid points where they
// render large. '3' is noticeably lighter and reads better small — the two
// most distant points only. Mirroring is randomized per spawn.
// tint: 0..1 darker/cooler for depth (kept light on '3' — it earns its
// distance slot by being pale).
// expose: fraction of the sprite standing above the cover line when fully
// up. Near anchors stay partially occluded — emerging from behind cover
// reads better than floating — while mids show more and open points show
// everything.
// mode: 'rise' pops up from behind an occluder; 'pop' grows in place for
// spots with nothing in front of them.
// darkDrop: soft dark halo behind the sprite where the background is
// bright (lit display cases) so a pale alien never disappears into it.

export interface SpawnAnchor {
  x: number;
  y: number;
  scale: number;
  sprite: "1" | "2" | "3";
  tint: number;
  expose: number;
  mode: "rise" | "pop";
  darkDrop?: boolean;
  occluder?: { x: number; y: number; w: number; h: number; layer: "bg" | "fg" };
}

export const SPAWN_ANCHORS_DESKTOP: SpawnAnchor[] = [
  // behind the ammo crates, bottom left — stays partially occluded
  { x: 0.16, y: 0.78, scale: 1.15, sprite: "1", tint: 0, expose: 0.72, mode: "rise",
    occluder: { x: 0.0, y: 0.78, w: 0.34, h: 0.22, layer: "fg" } },
  // behind the crates, bottom right — stays partially occluded
  { x: 0.85, y: 0.8, scale: 1.25, sprite: "2", tint: 0, expose: 0.72, mode: "rise",
    occluder: { x: 0.66, y: 0.8, w: 0.34, h: 0.2, layer: "fg" } },
  // beside the lit display cases, mid left — mostly visible now
  { x: 0.31, y: 0.6, scale: 0.75, sprite: "2", tint: 0.12, expose: 0.88, mode: "rise",
    occluder: { x: 0.2, y: 0.6, w: 0.22, h: 0.14, layer: "bg" } },
  // beside the display cases, mid right — mostly visible now
  { x: 0.7, y: 0.59, scale: 0.75, sprite: "1", tint: 0.12, expose: 0.88, mode: "rise",
    occluder: { x: 0.59, y: 0.59, w: 0.22, h: 0.14, layer: "bg" } },
  // far back in the dark corridor, centre — smallest and hardest
  { x: 0.5, y: 0.47, scale: 0.4, sprite: "3", tint: 0.14, expose: 0.9, mode: "rise", darkDrop: true,
    occluder: { x: 0.43, y: 0.47, w: 0.14, h: 0.09, layer: "bg" } },
  // corridor mouth, off-centre — second distant anchor
  { x: 0.42, y: 0.5, scale: 0.5, sprite: "3", tint: 0.1, expose: 0.9, mode: "rise", darkDrop: true,
    occluder: { x: 0.35, y: 0.5, w: 0.14, h: 0.1, layer: "bg" } },
  // open floor, mid right — no cover, grows in place
  { x: 0.6, y: 0.68, scale: 0.85, sprite: "1", tint: 0.05, expose: 1, mode: "pop" },
  // open aisle, far left — no cover, grows in place
  { x: 0.07, y: 0.63, scale: 0.7, sprite: "2", tint: 0.08, expose: 1, mode: "pop" },
];

export const SPAWN_ANCHORS_MOBILE: SpawnAnchor[] = [
  { x: 0.2, y: 0.74, scale: 1.1, sprite: "1", tint: 0, expose: 0.72, mode: "rise",
    occluder: { x: 0.0, y: 0.74, w: 0.42, h: 0.26, layer: "fg" } },
  { x: 0.82, y: 0.77, scale: 1.2, sprite: "2", tint: 0, expose: 0.72, mode: "rise",
    occluder: { x: 0.58, y: 0.77, w: 0.42, h: 0.23, layer: "fg" } },
  { x: 0.28, y: 0.56, scale: 0.7, sprite: "2", tint: 0.12, expose: 0.88, mode: "rise",
    occluder: { x: 0.16, y: 0.56, w: 0.26, h: 0.13, layer: "bg" } },
  { x: 0.74, y: 0.55, scale: 0.7, sprite: "1", tint: 0.12, expose: 0.88, mode: "rise",
    occluder: { x: 0.62, y: 0.55, w: 0.26, h: 0.13, layer: "bg" } },
  { x: 0.5, y: 0.44, scale: 0.42, sprite: "3", tint: 0.14, expose: 0.9, mode: "rise", darkDrop: true,
    occluder: { x: 0.42, y: 0.44, w: 0.16, h: 0.09, layer: "bg" } },
  // open floor, centre — no cover, grows in place
  { x: 0.5, y: 0.7, scale: 0.9, sprite: "1", tint: 0.04, expose: 1, mode: "pop" },
];

// --- Pistol composition ----------------------------------------------------
// Anchored bottom right, rotated CCW so the barrel points up-left, and
// scaled so the grip is cropped off the bottom. Only slide and barrel show.
export const PISTOL_LAYOUT = {
  anchorX: 0.78, // pivot x as a fraction of viewport width
  pivotBelow: 0.45, // pivot sits this fraction of pistol height BELOW the viewport bottom
  heightFrac: 0.8, // pistol display height / viewport height (desktop)
  heightFracMobile: 0.52,
  rotationDeg: -15,
  aimShift: 0.15, // fraction of cursor offset the pistol eases toward (desktop)
  recoilKickPx: 26,
  recoilTwistDeg: 4,
  // muzzle position inside the sprite, as fractions of its width/height
  muzzle: { x: 0.16, y: 0.05 },
};

// --- Parallax (desktop only) ----------------------------------------------
export const PARALLAX = {
  bg: 0.02, // background + aliens + mid occluders
  fg: 0.05, // foreground crate band
  smoothing: 0.1, // per-frame lerp toward the cursor
  overscan: 1.07, // background drawn this much larger so edges never show
};

/**
 * Backdrop contrast. Which spawn points sit over a brightly lit display
 * case is a property of the photograph, so the scene measures the actual
 * background behind each point instead of trusting a flag set by eye. A
 * pale sprite gets help sooner than a dark one.
 */
export const BACKDROP = {
  paleThreshold: 0.3, // above this mean luminance, ALIEN_3 needs a drop
  darkThreshold: 0.5, // sprites 1 and 2 hold their own for longer
  maxDrop: 0.62, // opacity of the halo at its strongest
  minFlagged: 0.35, // an anchor with darkDrop set never gets less than this
};

export const ASSET_LOAD_TIMEOUT_MS = 10_000;

// Hit-burst palette (pixel particles read well over the photo)
export const BURST_COLORS = ["#57b94a", "#57b94a", "#2e5f28", "#0b0a0c", "#f2efe7"];
