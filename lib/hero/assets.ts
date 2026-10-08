// ---------------------------------------------------------------------------
// Hero video. The "Molon Labe Recap", one cut per orientation: vertical for
// a phone held upright, horizontal for everything else. It plays muted and
// looping behind the headline (browsers only autoplay silent video).
//
// Never the raw upload (about 109MB each). Cloudinary sizes and encodes it
// per request: f_auto,q_auto,vc_auto picks the format and quality for the
// browser, ac_none drops the audio track nobody can hear, and w_ caps the
// width. About 8MB at these widths. The version in each path means a
// re-upload under the same name cannot be served stale from the CDN.
// ---------------------------------------------------------------------------

const CLOUD = "https://res.cloudinary.com/dsprn0ew4/video/upload";

export const HERO_VIDEOS = {
  desktop: {
    id: "Molon_Labe_Recap_horizontal_coywok",
    version: "v1791415684",
    width: 1600,
  },
  mobile: {
    id: "Molon_Labe_Recap__vertical_onjniu",
    version: "v1791415687",
    width: 900,
  },
};

function heroVideo(portrait: boolean) {
  return portrait ? HERO_VIDEOS.mobile : HERO_VIDEOS.desktop;
}

/** The video itself, sized and silent. */
export function heroVideoUrl(portrait: boolean): string {
  const v = heroVideo(portrait);
  return `${CLOUD}/f_auto,q_auto,vc_auto,ac_none,w_${v.width}/${v.version}/${v.id}.mp4`;
}

/**
 * The video's first frame as a still. Shown until the video is playing,
 * and instead of it for reduced motion or data saver. The first frame,
 * so the change from still to video does not show.
 */
export function heroPosterUrl(portrait: boolean): string {
  const v = heroVideo(portrait);
  return `${CLOUD}/so_0,f_webp,q_auto,w_${v.width}/${v.version}/${v.id}.webp`;
}
