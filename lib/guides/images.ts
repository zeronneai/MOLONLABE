import sharp from "sharp";

// Photographs, fetched and decoded here rather than by the renderer.
//
// TWO REASONS THE RENDERER IS NOT ALLOWED TO DO THIS ITSELF
//
// A failed fetch inside the renderer throws, and one dead URL would take
// down the whole document. Fetched here, a picture that cannot be had is
// simply absent from the guide — and the caller is told how many were
// absent, because a guide that renders perfectly with no photographs in
// it is the worst outcome available: nobody notices until a customer has
// paid for one.
//
// And the renderer reads JPEG and PNG and nothing else, while the
// catalogue is almost entirely WEBP. The admin compresses client side
// before uploading to Supabase Storage and the result is .webp, so this
// is not an edge case in the catalogue — it is the catalogue. Every
// photograph the shop has ever uploaded needed converting, and the first
// deployed guide came out with no pictures in it at all.
//
// WHY SHARP AND NOT A FORMAT CHANGE AT UPLOAD
//
// Uploading JPEG instead would be less code and would fix nothing that
// exists: the owner is not re-uploading his catalogue. It would also make
// the SITE worse — WebP is the right format for the web and the wrong one
// for a PDF — to fix a problem that only exists in the PDF. So the
// conversion lives at the point of use, and the catalogue keeps storing
// the best format for the pages people actually browse.
//
// sharp comes with Next already; it is named in package.json so that
// stays deliberate rather than lucky. It reads WebP, AVIF, HEIF, TIFF,
// GIF and PNG, which is more than the product-images bucket will ever
// accept.

export type GuideImage = { data: Buffer; format: "jpg" };

/** Nobody is served by a guide that spends thirty seconds on a photo. */
const FETCH_TIMEOUT_MS = 8000;

/**
 * The widest a photograph is placed on a Letter page, at 2x.
 *
 * Downscaling here rather than in the document: react-pdf embeds whatever
 * it is handed, so a 4000px original would ride around inside every copy
 * of the guide at full size for no visible benefit.
 */
const MAX_WIDTH = 1400;

/** Good enough that a plate looks like a photograph, small enough to send. */
const JPEG_QUALITY = 82;

/**
 * Cloudinary can hand back something smaller, so ask.
 *
 * This is now a bandwidth optimisation and nothing more — the conversion
 * below copes with whatever comes back. It is kept because the legacy
 * catalogue shots are Cloudinary originals and some of them are large.
 */
export function guideImageUrl(url: string): string {
  if (!url.includes("res.cloudinary.com")) return url;
  if (!url.includes("/upload/")) return url;
  // Don't stack a second transform onto one that is already there.
  if (/\/upload\/[^/]*[,_][^/]*\//.test(url)) return url;
  return url.replace("/upload/", `/upload/q_auto:good,w_${MAX_WIDTH}/`);
}

/** Whatever came down the wire, as a JPEG the renderer can read. */
async function toJpeg(bytes: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      // `withoutEnlargement` so a small photograph is not upscaled into
      // a blurry one to fill a plate it was never big enough for.
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      // Flattened onto the page colour. A PNG or WebP with transparency
      // becomes black where it was clear, otherwise, and the guide is a
      // dark document — a cut-out product shot would lose its edges.
      .flatten({ background: "#131417" })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    console.error("guide image could not be decoded:", error);
    return null;
  }
}

export type FetchedImages = {
  images: GuideImage[];
  /** How many were asked for. */
  wanted: number;
  /** The URLs that did not make it, for the log and the owner's message. */
  dropped: string[];
};

/**
 * One picture, or null.
 *
 * Never throws. Every failure — unreachable host, a 404, bytes that are
 * not an image at all — comes back as null, because the caller's correct
 * response to all of them is the same: leave it out and say so.
 */
export async function fetchGuideImage(url: string): Promise<GuideImage | null> {
  const target = guideImageUrl(url);
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`guide image ${res.status}: ${target}`);
      return null;
    }
    const data = await toJpeg(Buffer.from(await res.arrayBuffer()));
    if (!data) {
      console.error(`guide image was left out, could not convert: ${target}`);
      return null;
    }
    return { data, format: "jpg" };
  } catch (error) {
    console.error(`guide image failed: ${target} —`, error);
    return null;
  }
}

/**
 * Several, in parallel, with the failures counted rather than swallowed.
 *
 * The counts are the whole point of the return shape. They are recorded
 * against the game and shown to the owner, so a guide that came out short
 * is visible before a customer is the one who notices.
 */
export async function fetchGuideImages(urls: string[]): Promise<FetchedImages> {
  const fetched = await Promise.all(
    urls.map(async (url) => ({ url, image: await fetchGuideImage(url) })),
  );
  return {
    images: fetched
      .map((f) => f.image)
      .filter((i): i is GuideImage => i !== null),
    wanted: urls.length,
    dropped: fetched.filter((f) => !f.image).map((f) => f.url),
  };
}
