// ---------------------------------------------------------------------------
// Hero video. The "Molon Labe Recap", one cut per orientation: vertical for
// a phone held upright, horizontal for everything else. It plays muted and
// looping behind the headline (browsers only autoplay silent video).
//
// The files live in public/hero, already sized and encoded: H.264 MP4 with
// the audio track dropped (nobody can hear it), about 8MB each, plus the
// first frame of each as a WebP still.
// ---------------------------------------------------------------------------

export const HERO_VIDEOS = {
  desktop: { file: "desktop", width: 1600 },
  mobile: { file: "mobile", width: 900 },
};

function heroVideo(portrait: boolean) {
  return portrait ? HERO_VIDEOS.mobile : HERO_VIDEOS.desktop;
}

/** The video itself, sized and silent. */
export function heroVideoUrl(portrait: boolean): string {
  const v = heroVideo(portrait);
  return `/hero/${v.file}.mp4`;
}

/**
 * The video's first frame as a still. Shown until the video is playing,
 * and instead of it for reduced motion or data saver. The first frame,
 * so the change from still to video does not show.
 */
export function heroPosterUrl(portrait: boolean): string {
  const v = heroVideo(portrait);
  return `/hero/${v.file}.webp`;
}
