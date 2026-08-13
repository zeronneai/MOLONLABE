// ---------------------------------------------------------------------------
// Hero scrub assets. We never ship the video files — scrubbing
// video.currentTime stutters on iOS Safari. Instead each frame is an
// on-demand Cloudinary still (so_<seconds>) extracted from the clip.
// ---------------------------------------------------------------------------

const CLOUD = "https://res.cloudinary.com/dsprn0ew4/video/upload";

// `seconds` is a FALLBACK duration only. The real one is measured from
// Cloudinary at request time (lib/hero/duration.ts) and a mismatch logs a
// warning naming this constant, so a re-exported clip cannot silently
// break the scrub.
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

// Looping hero-background clips that take over once the scrub completes.
// Picked by orientation like the frame sequence. If either is set to null
// the final scrub frame holds instead, which is the designed fallback.
export const HERO_LOOPS: { desktop: string | null; mobile: string | null } = {
  desktop: "hf_20260811_224431_b7ed0dcd-3b86-4d8f-be95-d55b9ca769cc_z1icog",
  mobile: "hf_20260811_224417_c4b6870b-855a-4cc2-8e55-f73dd93821f0_bkkq06",
};

// Seam handling: the loops were generated without a matching end frame, so
// HeroScrub plays them through two stacked <video> elements offset in time,
// cross-fading over the last CROSSFADE_S of each cycle instead of relying
// on the native loop attribute (which would visibly jump).
export const LOOP_CROSSFADE_S = 1;
// The loop must never compete with the frame sequence for bandwidth: it
// only starts fetching once the scrub is past this progress.
export const LOOP_PRELOAD_AT = 0.7;

// ~100 frames ≈ 15–25KB each as f_webp,q_auto → target under 2.5MB total.
export const FRAME_COUNT = 100;

// Scroll budget the scrub consumes (in viewport-heights of scrolling).
export const SCRUB_SCROLL_VH = { desktop: 150, mobile: 120 };

export function heroClip(portrait: boolean) {
  return portrait ? HERO_CLIPS.mobile : HERO_CLIPS.desktop;
}

/**
 * `seconds` overrides the configured duration with one measured from
 * Cloudinary (see lib/hero/duration.ts). The constant in HERO_CLIPS is
 * only a fallback for when that measurement is unavailable.
 */
export function heroFrameUrl(
  portrait: boolean,
  index: number,
  seconds?: number,
): string {
  const clip = heroClip(portrait);
  const duration = seconds && seconds > 0 ? seconds : clip.seconds;
  const t = ((duration * index) / (FRAME_COUNT - 1)).toFixed(2);
  return `${CLOUD}/so_${t},f_webp,q_auto,w_${clip.width}/${clip.id}.webp`;
}

// f_auto,q_auto,vc_auto: WebM for browsers that take it, right-sized H.264
// for the rest — never the raw upload.
export function heroLoopUrl(portrait: boolean): string | null {
  const id = portrait ? HERO_LOOPS.mobile : HERO_LOOPS.desktop;
  return id
    ? `${CLOUD}/f_auto,q_auto,vc_auto,w_${heroClip(portrait).width}/${id}.mp4`
    : null;
}
