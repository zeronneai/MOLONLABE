// Photographs, fetched here rather than by the renderer.
//
// `@react-pdf/renderer` will take a URL and fetch it itself. It is not
// used that way, for two reasons:
//
//   A failed fetch inside the renderer throws, and one dead image URL
//   would take down the whole document. Fetched here, a picture that
//   cannot be had is simply absent from the guide.
//
//   fontkit's image decoders handle JPEG and PNG and nothing else. The
//   catalogue holds WebP and AVIF too — the product-images bucket accepts
//   both, and there are .webp URLs in the seed data — so the bytes have
//   to be looked at before they are handed over. A WebP passed to the
//   renderer is an exception, not a missing picture.

export type GuideImage = { data: Buffer; format: "png" | "jpg" };

/** Nobody is served by a guide that spends thirty seconds on a photo. */
const FETCH_TIMEOUT_MS = 8000;

/**
 * Cloudinary can hand back exactly what the renderer can read, so ask.
 *
 * `f_jpg` rather than `f_auto`: f_auto negotiates from the Accept header
 * and would cheerfully return WebP to a fetch that sends none. Width is
 * capped at the widest a photograph is placed on a Letter page at 2x.
 */
export function guideImageUrl(url: string): string {
  if (!url.includes("res.cloudinary.com")) return url;
  if (!url.includes("/upload/")) return url;
  // Don't stack a second transform onto one that is already there.
  if (/\/upload\/[^/]*[,_][^/]*\//.test(url)) return url;
  return url.replace("/upload/", "/upload/f_jpg,q_auto:good,w_1000/");
}

/** PNG and JPEG have unambiguous first bytes. Everything else is refused. */
function sniff(bytes: Buffer): "png" | "jpg" | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

/**
 * One picture, or null.
 *
 * Never throws. Every failure — unreachable host, a 404, a format the
 * renderer cannot read — comes back as null and is logged, because the
 * caller's correct response to all of them is the same: leave it out.
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
    const data = Buffer.from(await res.arrayBuffer());
    const format = sniff(data);
    if (!format) {
      console.error(
        `guide image is not PNG or JPEG and was left out: ${target}`,
      );
      return null;
    }
    return { data, format };
  } catch (error) {
    console.error(`guide image failed: ${target} —`, error);
    return null;
  }
}

/** Several, in parallel, with the failures dropped rather than propagated. */
export async function fetchGuideImages(urls: string[]): Promise<GuideImage[]> {
  const fetched = await Promise.all(urls.map(fetchGuideImage));
  return fetched.filter((i): i is GuideImage => i !== null);
}
