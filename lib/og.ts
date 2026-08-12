// Font loading for next/og cards. DESIGN.md bans any face that is not
// Archivo, so the cards fetch it rather than falling back to a system
// sans. The fetch is cached by the runtime between renders; if it ever
// fails we render with the default face instead of throwing, because a
// plain card beats a broken share image.

type FontWeight = 400 | 600 | 800;

interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal";
}

const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;800&display=swap";

export async function archivoFonts(): Promise<LoadedFont[]> {
  try {
    const css = await fetch(CSS_URL, {
      // A desktop UA gets woff2; next/og needs woff or ttf, so ask as a
      // client that is served the older format.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0)" },
    }).then((r) => r.text());

    const urls = [...css.matchAll(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|woff)'\)/g)].map(
      (m) => m[1],
    );
    if (urls.length === 0) return [];

    const weights: FontWeight[] = [400, 800];
    const fonts = await Promise.all(
      urls.slice(0, 2).map(async (url, i) => ({
        name: "Archivo",
        data: await fetch(url).then((r) => r.arrayBuffer()),
        weight: weights[i] ?? 400,
        style: "normal" as const,
      })),
    );
    return fonts;
  } catch {
    // No network, or Google changed the response shape: use the default.
    return [];
  }
}
