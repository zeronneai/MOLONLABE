// Handoff coordination between the intro overlay and the hero scrub.
// The overlay's wipe must never reveal an unpainted hero, so the hero
// signals here the moment frame 0 is actually on its canvas, and the
// overlay gates the wipe on that signal. Module-level singletons because
// the two components are distant siblings; every call is client-side.

let present = false;
let painted = false;
let waiters: (() => void)[] = [];

/** Timestamped handoff timeline — visible under the console's Verbose filter. */
export function seqLog(msg: string): void {
  console.debug(`[handoff] ${msg} @ ${Math.round(performance.now())}ms`);
}

/** The hero is on this page; the overlay should wait for its paint. */
export function markHeroPresent(): void {
  present = true;
}

/** Frame 0 (or the static fallback) is visibly painted. */
export function markHeroPainted(): void {
  if (painted) return;
  painted = true;
  seqLog("hero painted — releasing any waiters");
  const cbs = waiters;
  waiters = [];
  for (const cb of cbs) cb();
}

/**
 * Run cb once the hero has painted. Immediate on pages with no hero and
 * when the paint already happened. Returns a cancel function. The
 * fail-safe timer exists ONLY so the overlay can never hold the site
 * hostage if the hero errors before signalling; it logs loudly.
 */
export function whenHeroPainted(cb: () => void, failSafeMs = 4000): () => void {
  if (!present || painted) {
    cb();
    return () => {};
  }
  let done = false;
  const timer = window.setTimeout(() => {
    if (done) return;
    done = true;
    console.warn("[handoff] hero paint signal timed out — continuing anyway");
    cb();
  }, failSafeMs);
  waiters.push(() => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    cb();
  });
  return () => {
    done = true;
    window.clearTimeout(timer);
  };
}
