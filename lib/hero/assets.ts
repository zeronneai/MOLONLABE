// ---------------------------------------------------------------------------
// Hero scrub assets. We never ship the video files — scrubbing
// video.currentTime stutters on iOS Safari. Instead each frame is an
// on-demand Cloudinary still (so_<seconds>) extracted from the clip.
// ---------------------------------------------------------------------------

const CLOUD = "https://res.cloudinary.com/dsprn0ew4/video/upload";

// ⚠ seconds = clip duration. Set from the real clips — a wrong duration
// makes the tail frames 404, which the runtime verification catches and
// falls back from (loudly).
export const HERO_CLIPS = {
  desktop: {
    id: "hf_20260811_222157_239af25b-ddcd-4da6-971b-c93aeedbcd47_karb6y",
    seconds: 5,
    width: 1600,
  },
  mobile: {
    id: "hf_20260811_222400_cae54a51-ac9b-4467-8329-7d9e5dcce031_lbhhis",
    seconds: 5,
    width: 900,
  },
};

// Looping hero-background clips — not delivered yet. When they land, set
// the public ids here and the scrub hands off to them automatically; while
// null the final scrub frame holds, which is the designed fallback anyway.
export const HERO_LOOPS: { desktop: string | null; mobile: string | null } = {
  desktop: null,
  mobile: null,
};

// ~100 frames ≈ 15–25KB each as f_webp,q_auto → target under 2.5MB total.
export const FRAME_COUNT = 100;

// Scroll budget the scrub consumes (in viewport-heights of scrolling).
export const SCRUB_SCROLL_VH = { desktop: 150, mobile: 120 };

export function heroClip(portrait: boolean) {
  return portrait ? HERO_CLIPS.mobile : HERO_CLIPS.desktop;
}

export function heroFrameUrl(portrait: boolean, index: number): string {
  const clip = heroClip(portrait);
  const t = ((clip.seconds * index) / (FRAME_COUNT - 1)).toFixed(2);
  return `${CLOUD}/so_${t},f_webp,q_auto,w_${clip.width}/${clip.id}.webp`;
}

export function heroLoopUrl(portrait: boolean): string | null {
  const id = portrait ? HERO_LOOPS.mobile : HERO_LOOPS.desktop;
  return id ? `${CLOUD}/f_auto,q_auto,w_${heroClip(portrait).width}/${id}.mp4` : null;
}
