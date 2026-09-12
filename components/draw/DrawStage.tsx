"use client";

// The draw presentation. This is content, not an admin function: it runs
// fullscreen, carries no navigation, and is designed to be filmed.
//
// The one rule the whole file is organised around: THE ANIMATION REVEALS,
// IT DOES NOT DECIDE. `commitDraw` runs to completion and writes the
// winner to the database before a single frame plays. Everything below
// receives that finished record as `reveal` and animates toward it. The
// reel, the shuffle and the tile sampling all use Math.random, which is a
// different source from the seeded selector, so there is no path by which
// a visual decision can reach the recorded result.
//
// Privacy: every name that arrives here is already first-name-plus-last-
// initial. No email, phone or surname is passed into this component at
// all, so none can be rendered by mistake.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { commitDraw } from "@/app/admin/actions";
import { LOGO_URL, SHOP_SHORT_NAME } from "@/lib/brand";
import { newSeed, selectWinner } from "@/lib/draw/select";
import { buildPool, buildReel } from "@/lib/draw/pool";
import {
  CONTROLS_HIDE_MS,
  MAX_REEL,
  POOL_FILL_MS,
  POOL_HOLD_MS,
  SPIN_MS,
  SPIN_TICKS,
  rehearsalPool,
  spinEase,
  type Orientation,
  type PoolMember,
  type Reveal,
} from "@/lib/draw/presentation";

type Phase = "setup" | "pool" | "spin" | "lock";

/**
 * Formatted in the shop's own timezone rather than the recording device's.
 * A timestamp on a broadcast proof line is only useful if it means the
 * same thing to everyone watching it.
 */
function stamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function DrawStage({
  gameId,
  prizeName,
  prizeImage,
  closesLabel,
  pool,
  entries,
  entrants,
  alreadyDrawn,
  unsoldSpots = 0,
}: {
  gameId: string;
  prizeName: string;
  prizeImage: string | null;
  closesLabel: string | null;
  pool: PoolMember[];
  entries: number;
  entrants: number;
  alreadyDrawn: boolean;
  /** Spots still unsold. Drawing with any left goes against the terms. */
  unsoldSpots?: number;
}) {
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [rehearsal, setRehearsal] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  // An early draw is acknowledged HERE, on the setup screen, before
  // anything is recorded. The admin asks in a modal; doing that on this
  // screen would put a dialog in the middle of the take, and the owner
  // would be reading terms on camera.
  const [earlyAccepted, setEarlyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [controlsOn, setControlsOn] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<string[]>([]);
  const hideTimer = useRef<number | null>(null);

  /**
   * Copy and Done are summoned rather than shown. Anything standing on the
   * frame after the lock ends up in the recording, and the hold on the
   * winner is the shot. Hiding them outside the frame instead would only
   * work where there is letterbox to hide them in — on the phone, which is
   * the device that matters, the frame is the whole viewport.
   *
   * So: pointer movement or a key brings them back for a few seconds and
   * they leave again. That is hover on a monitor and a tap on a phone,
   * without two mechanisms to maintain.
   */
  const nudgeControls = useCallback(() => {
    setControlsOn(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(
      () => setControlsOn(false),
      CONTROLS_HIDE_MS,
    );
  }, []);

  const holdControls = useCallback(() => {
    // Focus is inside the group — a keyboard user is mid-interaction and
    // must not have the thing they are aiming at fade out from under them.
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    setControlsOn(true);
  }, []);

  useEffect(() => {
    if (phase !== "lock") return;
    const onKey = () => nudgeControls();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, nudgeControls]);

  useEffect(
    () => () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  // Rehearsal swaps the entire pool for fabricated data and never calls
  // the server action, so a practice run cannot write a winner. The stats
  // follow the fake pool too — a setup card quoting the real entry count
  // over a fake pool would be rehearsing a lie.
  const activePool = useMemo<PoolMember[]>(
    () => (rehearsal ? rehearsalPool() : pool),
    [rehearsal, pool],
  );
  const activeEntries = useMemo(
    () =>
      rehearsal
        ? activePool.reduce((sum, m) => sum + Math.max(1, m.weight), 0)
        : entries,
    [rehearsal, activePool, entries],
  );
  const activeEntrants = rehearsal ? activePool.length : entrants;

  // Built once per run, when the pool is known and the phase leaves setup.
  const poolView = useMemo(
    () => (phase === "setup" ? null : buildPool(activePool)),
    [phase, activePool],
  );

  /**
   * Tile type scales with the tile count so the pool fills the frame at
   * any pot size. Left at one size, a 60-entry pot reads as a thin band
   * floating in the middle and the step stops making the point it exists
   * to make.
   *
   * Area a tile occupies goes with the square of its type size, so
   * `count * scale^2` is roughly constant for a given fill. The constants
   * are measured against each frame — 16:9 has about 82% of the area of
   * 9:16 in these units, hence the smaller one. Clamped at both ends: a
   * ten-name pot should not render in headline type, and a full pot
   * should stay above the size where names stop being readable on a
   * re-encoded stream.
   */
  const tileScale = useMemo(() => {
    const n = poolView?.tiles.length ?? 0;
    if (n === 0) return 2.4;
    const fill = orientation === "vertical" ? 1280 : 1030;
    return Math.min(5.6, Math.max(1.9, Math.sqrt(fill / n)));
  }, [poolView, orientation]);

  const start = useCallback(async () => {
    if (busy) return;
    setError(null);
    setCopied(false);

    let record: Reveal;
    if (rehearsal) {
      // Entirely local. selectWinner is pure, so this exercises the real
      // selection code against fake entrants without a network call.
      const seed = newSeed();
      const picked = selectWinner(
        activePool.map((m) => ({ id: m.id, weight: m.weight })),
        seed,
      );
      const member = activePool.find((m) => m.id === picked?.entrantId);
      if (!picked || !member) {
        setError("Rehearsal pool is empty.");
        return;
      }
      record = {
        name: member.name,
        ticket: picked.ticket,
        total: picked.total,
        seed: picked.seed,
        drawnAt: new Date().toISOString(),
      };
    } else {
      setBusy(true);
      const result = await commitDraw(gameId, earlyAccepted);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      record = {
        name: result.name,
        ticket: result.ticket,
        total: result.total,
        seed: result.seed,
        drawnAt: result.drawnAt,
      };
    }

    setReveal(record);
    reelRef.current = buildReel(activePool, MAX_REEL);

    // Reduced motion gets the result, not a shortened version of the
    // theater. Skipping to the lock is the honest translation of an
    // eight-second deceleration for someone who has asked not to be
    // moved around.
    const still =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPhase(still ? "lock" : "pool");
    // `earlyAccepted` MUST be in here. Without it this callback closes
    // over the value from the render in which it was created — false —
    // and commitDraw is called unacknowledged however many times the box
    // is ticked. The server then refuses, and its refusal appears as an
    // error on the filmed screen with no way past it.
  }, [busy, rehearsal, activePool, gameId, earlyAccepted]);

  // Pool holds, then hands off to the spin.
  useEffect(() => {
    if (phase !== "pool") return;
    const id = window.setTimeout(
      () => setPhase("spin"),
      POOL_FILL_MS + POOL_HOLD_MS,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  // The spin. Written straight to the DOM node rather than through state:
  // at the opening rate this changes the name on almost every frame, and
  // a React render per frame is the one thing guaranteed to cost the
  // 60fps this has to hold on a phone.
  useEffect(() => {
    if (phase !== "spin" || !reveal) return;
    const el = nameRef.current;
    const reel = reelRef.current;
    if (!el || reel.length === 0) {
      setPhase("lock");
      return;
    }

    let raf = 0;
    let lastTick = -1;
    let lastBlur = "";
    let tense = false;
    const begin = performance.now();

    const frame = (now: number) => {
      const t = Math.min(1, (now - begin) / SPIN_MS);
      const tick = Math.floor(spinEase(t) * SPIN_TICKS);
      if (tick !== lastTick) {
        lastTick = tick;
        el.textContent = reel[tick % reel.length];
      }
      // Three discrete blur steps rather than a per-frame filter value:
      // animating a blur radius on type this large is expensive on mobile
      // and reads identically at two switch points.
      const blur = t < 0.25 ? "hi" : t < 0.55 ? "mid" : "none";
      if (blur !== lastBlur) {
        lastBlur = blur;
        el.dataset.blur = blur;
      }
      if (!tense && t > 0.72) {
        tense = true;
        el.dataset.tense = "true";
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else setPhase("lock");
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      // These were set on the node directly, so React has no record of
      // them and will not clear them on the next render. Left behind,
      // the winner would lock in blurred and still breathing.
      el.removeAttribute("data-blur");
      el.removeAttribute("data-tense");
    };
  }, [phase, reveal]);

  const summary = useCallback(() => {
    if (!reveal) return "";
    return [
      `WINNER — ${prizeName}`,
      "",
      reveal.name,
      "",
      `Winning spot ${reveal.ticket}`,
      `${reveal.total} ${reveal.total === 1 ? "spot" : "spots"} sold to ${activeEntrants} ${activeEntrants === 1 ? "buyer" : "buyers"}`,
      `Drawn ${stamp(reveal.drawnAt)} MT`,
      `Seed ${reveal.seed}`,
      "",
      `Every spot was one ticket. ${SHOP_SHORT_NAME}`,
    ].join("\n");
  }, [reveal, prizeName, activeEntrants]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setError("Could not reach the clipboard. Read the numbers off the screen.");
    }
  }, [summary]);

  const fullscreen = useCallback(() => {
    stageRef.current?.requestFullscreen?.().catch(() => {
      // Denied or unsupported — the layout is identical either way, so
      // there is nothing to fall back to.
    });
  }, []);

  const reset = useCallback(() => {
    setPhase("setup");
    setReveal(null);
    setCopied(false);
    setError(null);
  }, []);

  return (
    <div className="draw-stage" ref={stageRef}>
      <div
        className="draw-frame"
        data-orientation={orientation}
        data-phase={phase}
        data-controls={controlsOn ? "on" : "off"}
        onPointerMove={phase === "lock" ? nudgeControls : undefined}
        onPointerDown={phase === "lock" ? nudgeControls : undefined}
      >
        {/* Corner mark. Present in every phase — it is the only branding
            on screen and it needs to survive a crop. */}
        <div className="draw-mark">
          <Image src={LOGO_URL} alt="" width={96} height={96} priority />
        </div>

        {rehearsal && (
          <p className="draw-badge label">Rehearsal — nothing is recorded</p>
        )}

        {/* ---------------------------------------------------------- 1 */}
        {phase === "setup" && (
          <div className="draw-setup">
            <div className="draw-prize">
              {prizeImage ? (
                <Image
                  src={prizeImage}
                  alt=""
                  fill
                  sizes="(orientation: portrait) 70vw, 40vh"
                  className="object-cover"
                  priority
                />
              ) : (
                <span className="label draw-prize-empty">No prize image</span>
              )}
            </div>

            {/* Wrapper so 16:9 can run this as the second column rather
                than laying every line out as its own flex child. */}
            <div className="draw-copy">
            <p className="draw-eyebrow label">The Draw</p>
            <h1 className="draw-title display">{prizeName.toUpperCase()}</h1>

            <dl className="draw-stats">
              <div>
                <dt className="label">Spots sold</dt>
                <dd>{activeEntries.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="label">Buyers</dt>
                <dd>{activeEntrants.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="label">Closed</dt>
                <dd>{closesLabel ?? "—"}</dd>
              </div>
            </dl>

            {alreadyDrawn && !rehearsal && (
              <p className="draw-note">
                This game already has a winner. Starting replays the
                recorded result — it will not draw again.
              </p>
            )}

            {!alreadyDrawn && !rehearsal && unsoldSpots > 0 && (
              <div className="draw-note draw-note-caution">
                <p>
                  <strong>{unsoldSpots}</strong> of{" "}
                  <strong>{unsoldSpots + activeEntries}</strong> spots are
                  unsold. The terms buyers agreed to say the game runs until
                  every spot sells, so drawing now goes against them. It will
                  be recorded on the result.
                </p>
                <label className="draw-note-ack">
                  <input
                    type="checkbox"
                    checked={earlyAccepted}
                    onChange={(e) => setEarlyAccepted(e.target.checked)}
                  />
                  <span>I understand — draw this game short.</span>
                </label>
              </div>
            )}

            {error && <p className="draw-error label">{error}</p>}

            <div className="draw-controls">
              <button
                type="button"
                onClick={start}
                disabled={
                  busy ||
                  activeEntries === 0 ||
                  (!alreadyDrawn && !rehearsal && unsoldSpots > 0 && !earlyAccepted)
                }
                className="control control-caution draw-start"
              >
                {busy
                  ? "Drawing…"
                  : activeEntries === 0
                    ? "No spots sold"
                    : rehearsal
                      ? "Start rehearsal"
                      : alreadyDrawn
                        ? "Replay the draw"
                        : unsoldSpots > 0 && !earlyAccepted
                          ? "Tick the box to draw short"
                          : "Start the draw"}
              </button>

              <div className="seg draw-seg">
                <button
                  type="button"
                  aria-pressed={orientation === "vertical"}
                  onClick={() => setOrientation("vertical")}
                  className="control control-sm"
                >
                  9:16
                </button>
                <button
                  type="button"
                  aria-pressed={orientation === "horizontal"}
                  onClick={() => setOrientation("horizontal")}
                  className="control control-sm"
                >
                  16:9
                </button>
              </div>

              <div className="draw-minor">
                <button
                  type="button"
                  aria-pressed={rehearsal}
                  onClick={() => setRehearsal((r) => !r)}
                  className="control control-sm tone-caution"
                >
                  Rehearsal
                </button>
                <button
                  type="button"
                  onClick={fullscreen}
                  className="control control-sm"
                >
                  Fullscreen
                </button>
                {/* Was /admin/featured, which does not exist — so the
                    only control that claimed to leave this screen 404'd.
                    It goes back to the game it belongs to. */}
                <a href={`/admin/games/${gameId}`} className="control control-sm">
                  Exit
                </a>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------- 2 & 4 */}
        {phase !== "setup" && poolView && (
          <>
            <div
              className="draw-pool"
              aria-hidden="true"
              style={{ "--tile": tileScale } as React.CSSProperties}
            >
              {poolView.tiles.map((tile, i) => (
                <span
                  key={tile.key}
                  className="draw-tile"
                  style={{
                    // Staggered across the fill window. Multiplying by the
                    // index directly would push late tiles past the hold.
                    animationDelay: `${(i / poolView.tiles.length) * POOL_FILL_MS}ms`,
                  }}
                >
                  {tile.name}
                </span>
              ))}
            </div>
            {poolView.hidden > 0 && (
              <p className="draw-pool-note label">
                showing {poolView.tiles.length.toLocaleString()} of{" "}
                {poolView.total.toLocaleString()} spots
              </p>
            )}
          </>
        )}

        {/* ------------------------------------------------------- 3 & 4 */}
        {(phase === "spin" || phase === "lock") && reveal && (
          <div className="draw-reveal">
            <p className="draw-reveal-label label">
              {phase === "lock" ? "Winner" : "Drawing"}
            </p>
            <div ref={nameRef} className="draw-name display">
              {phase === "lock" ? reveal.name : ""}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- 5 */}
        {phase === "lock" && reveal && (
          <div className="draw-record">
            {/* `ticket` is the winning SPOT NUMBER, not an index into
                the pool. This used to read "Entry N of TOTAL", which was
                the per-dollar model's wording: there, N really was the
                Nth ticket of TOTAL. A spot number is not an ordinal, and
                on a partly-sold game it routinely exceeds the pool — a
                20-spot game with 12 sold and spot 16 drawn rendered
                "Entry 16 of 12" on the screen being filmed. */}
            <p>
              Spot <strong>{reveal.ticket.toLocaleString()}</strong> ·{" "}
              {reveal.total.toLocaleString()}{" "}
              {reveal.total === 1 ? "spot" : "spots"} sold ·{" "}
              {stamp(reveal.drawnAt)} MT
            </p>
            <p>seed {reveal.seed}</p>
            {error && <p className="draw-error label">{error}</p>}
          </div>
        )}

        {/* Summoned, not shown — see nudgeControls. Kept out of the record
            block so the proof line can stay on screen permanently while
            these come and go. */}
        {phase === "lock" && reveal && (
          <div
            className="draw-after"
            onFocusCapture={holdControls}
            onBlurCapture={nudgeControls}
          >
            <button type="button" onClick={copy} className="control control-sm">
              {copied ? "Copied" : "Copy summary"}
            </button>
            <button type="button" onClick={reset} className="control control-sm">
              Done
            </button>
            {/* The draw is over and the recording has stopped. Before
                this there was no way off the screen once a winner was up
                except the browser's own back button. */}
            <a href={`/admin/games/${gameId}`} className="control control-sm">
              Back to the game
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
