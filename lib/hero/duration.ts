// Clip durations, measured rather than assumed.
//
// The scrub extracts ~100 stills at so_<t> across the clip. If the
// duration we use is longer than the real clip, the tail frames 404 and
// the whole scrub falls back to a static frame; if it is shorter, the
// scrub silently stops before the end of the shot. Either way a constant
// typed in by hand is a bug waiting for someone to re-export a video.
//
// Cloudinary exposes this through the fl_getinfo delivery flag, which is
// a plain public URL — no Admin API credentials, no signing.

import { HERO_CLIPS } from "./assets";

const CLOUD = "https://res.cloudinary.com/dsprn0ew4/video/upload";

export interface ClipDurations {
  desktop: number;
  mobile: number;
  /** True when either value is the configured fallback, not a measurement. */
  assumed: boolean;
}

/** Pull a duration out of fl_getinfo's payload without trusting its shape. */
function readDuration(payload: unknown): number | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): number | null => {
    if (depth > 4 || node === null || typeof node !== "object" || seen.has(node)) {
      return null;
    }
    seen.add(node);
    const record = node as Record<string, unknown>;
    const direct = record.duration;
    if (typeof direct === "number" && direct > 0) return direct;
    if (typeof direct === "string" && Number(direct) > 0) return Number(direct);
    for (const value of Object.values(record)) {
      const found = walk(value, depth + 1);
      if (found !== null) return found;
    }
    return null;
  };
  return walk(payload, 0);
}

async function measure(publicId: string, configured: number): Promise<number> {
  try {
    const res = await fetch(`${CLOUD}/fl_getinfo/${publicId}.json`, {
      // Durations change only when a clip is re-exported.
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`fl_getinfo ${res.status}`);
    const duration = readDuration(await res.json());
    if (duration === null) throw new Error("no duration in payload");

    // Loud, not silent: a mismatch means the constant in assets.ts is
    // stale and someone should fix it, even though we just worked around
    // it for this request.
    if (Math.abs(duration - configured) > 0.05) {
      console.warn(
        `[hero] ${publicId}: configured ${configured}s, actual ${duration.toFixed(2)}s — ` +
          `using the measured value. Update HERO_CLIPS.seconds in lib/hero/assets.ts.`,
      );
    }
    return duration;
  } catch (err) {
    console.error(
      `[hero] could not measure ${publicId}, falling back to the configured ${configured}s. ` +
        `If that is wrong the tail frames will 404 and the scrub will go static:`,
      err,
    );
    return configured;
  }
}

/**
 * Real durations for both clips. Called from the server so the fetch is
 * cached and never costs the visitor anything.
 */
export async function getClipDurations(): Promise<ClipDurations> {
  const [desktop, mobile] = await Promise.all([
    measure(HERO_CLIPS.desktop.id, HERO_CLIPS.desktop.seconds),
    measure(HERO_CLIPS.mobile.id, HERO_CLIPS.mobile.seconds),
  ]);
  return {
    desktop,
    mobile,
    assumed:
      desktop === HERO_CLIPS.desktop.seconds && mobile === HERO_CLIPS.mobile.seconds,
  };
}
