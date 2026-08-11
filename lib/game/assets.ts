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
  alienA: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786484246/alien-a_emywbt.webp",
    400, // only ever renders small, at the distant anchors
  ),
  alienB: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786484245/alien-b_mizegp.webp",
    900,
  ),
  pistol: cld(
    "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786484323/pistol_1_pqjirg.webp",
    900,
  ),
};

// --- Spawn anchors, normalized to the viewport -----------------------------
// x/y: where the alien stands; y is the occlusion line (cover top edge).
// scale: relative alien size (1 = near foreground).
// sprite: 'B' is the primary clean cutout; 'A' only at the two distant
// anchors where it renders small. tint: 0..1 darker/cooler for depth.
// occluder: viewport-normalized rect re-cropped FROM the background and
// redrawn on top, hiding the sprite's ragged lower edge.

export interface SpawnAnchor {
  x: number;
  y: number;
  scale: number;
  sprite: "A" | "B";
  flip: boolean;
  tint: number;
  occluder: { x: number; y: number; w: number; h: number; layer: "bg" | "fg" };
}

export const SPAWN_ANCHORS_DESKTOP: SpawnAnchor[] = [
  // behind the ammo crates, bottom left
  { x: 0.16, y: 0.78, scale: 1.15, sprite: "B", flip: false, tint: 0,
    occluder: { x: 0.0, y: 0.78, w: 0.34, h: 0.22, layer: "fg" } },
  // behind the crates, bottom right
  { x: 0.85, y: 0.8, scale: 1.25, sprite: "B", flip: true, tint: 0,
    occluder: { x: 0.66, y: 0.8, w: 0.34, h: 0.2, layer: "fg" } },
  // beside the lit display cases, mid left
  { x: 0.31, y: 0.6, scale: 0.75, sprite: "B", flip: true, tint: 0.16,
    occluder: { x: 0.2, y: 0.6, w: 0.22, h: 0.14, layer: "bg" } },
  // beside the display cases, mid right
  { x: 0.7, y: 0.59, scale: 0.75, sprite: "B", flip: false, tint: 0.16,
    occluder: { x: 0.59, y: 0.59, w: 0.22, h: 0.14, layer: "bg" } },
  // far back in the dark corridor, centre — smallest and hardest
  { x: 0.5, y: 0.47, scale: 0.38, sprite: "A", flip: false, tint: 0.45,
    occluder: { x: 0.43, y: 0.47, w: 0.14, h: 0.09, layer: "bg" } },
  // corridor mouth, off-centre — second distant anchor
  { x: 0.42, y: 0.5, scale: 0.48, sprite: "A", flip: true, tint: 0.34,
    occluder: { x: 0.35, y: 0.5, w: 0.14, h: 0.1, layer: "bg" } },
];

export const SPAWN_ANCHORS_MOBILE: SpawnAnchor[] = [
  { x: 0.2, y: 0.74, scale: 1.1, sprite: "B", flip: false, tint: 0,
    occluder: { x: 0.0, y: 0.74, w: 0.42, h: 0.26, layer: "fg" } },
  { x: 0.82, y: 0.77, scale: 1.2, sprite: "B", flip: true, tint: 0,
    occluder: { x: 0.58, y: 0.77, w: 0.42, h: 0.23, layer: "fg" } },
  { x: 0.28, y: 0.56, scale: 0.7, sprite: "B", flip: true, tint: 0.16,
    occluder: { x: 0.16, y: 0.56, w: 0.26, h: 0.13, layer: "bg" } },
  { x: 0.74, y: 0.55, scale: 0.7, sprite: "B", flip: false, tint: 0.16,
    occluder: { x: 0.62, y: 0.55, w: 0.26, h: 0.13, layer: "bg" } },
  { x: 0.5, y: 0.44, scale: 0.4, sprite: "A", flip: false, tint: 0.45,
    occluder: { x: 0.42, y: 0.44, w: 0.16, h: 0.09, layer: "bg" } },
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

export const ASSET_LOAD_TIMEOUT_MS = 10_000;

// Hit-burst palette (pixel particles read well over the photo)
export const BURST_COLORS = ["#57b94a", "#57b94a", "#2e5f28", "#0b0a0c", "#f2efe7"];
