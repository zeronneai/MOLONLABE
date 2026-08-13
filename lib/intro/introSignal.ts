// The intro game announces when it is out of the way. The age gate waits
// on this so the two overlays can never stack, and so the gate does not
// flash over the game on a first visit.
//
// Module-level rather than context: the two components are distant
// siblings in the layout, and this is one boolean.

let resolved = false;
let waiters: (() => void)[] = [];

/** Called when the intro overlay unmounts, whatever the reason. */
export function markIntroResolved(): void {
  if (resolved) return;
  resolved = true;
  const cbs = waiters;
  waiters = [];
  for (const cb of cbs) cb();
}

/**
 * Run cb once the intro is done. Fires immediately if it already is —
 * including the common case where the game never mounts at all (returning
 * visitor, reduced motion, missing art), because IntroGame resolves the
 * signal on every one of those paths.
 */
export function whenIntroResolved(cb: () => void): () => void {
  if (resolved) {
    cb();
    return () => {};
  }
  let cancelled = false;
  waiters.push(() => {
    if (!cancelled) cb();
  });
  return () => {
    cancelled = true;
  };
}
