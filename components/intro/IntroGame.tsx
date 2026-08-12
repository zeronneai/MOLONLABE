"use client";

// First-person pixel shooting gallery shown on first visit.
// Remove the <IntroGame /> line in app/(site)/layout.tsx to drop the
// whole feature. All game logic lives in lib/game/.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CROSSFADE_MS, DESKTOP_TUNING, MOBILE_TUNING } from "@/lib/game/config";
import type { GameSettings } from "@/lib/game/settings";
import { recordGameEvent } from "@/app/actions/game";
import {
  STEP,
  addRipple,
  createArcade,
  fire,
  resizeArcade,
  update,
  type ArcadeState,
  type ShotResult,
} from "@/lib/game/engine";
import {
  buildScene,
  loadBackground,
  loadGameArt,
  type GameArt,
  type Scene,
} from "@/lib/game/scene";
import { PARALLAX } from "@/lib/game/assets";
import { renderFrame, type Pointer, type ViewFx } from "@/lib/game/render";
import { track } from "@/lib/analytics";
import { seqLog, whenHeroPainted } from "@/lib/hero/paintSignal";

const SEEN_KEY = "mlf_intro_seen";

// The ending is one continuous shot. The round resolves by cross-fading the
// shop interior into the hero scrub's already-painted frame 0 — the scope
// view — and everything after that sits on top of that same image: result
// card, code, buttons. Closing fades the card off it. Nothing underneath
// ever changes, so scrolling simply pulls the camera back out of the scope.
type Phase =
  | "idle"
  | "loading"
  | "arcade"
  | "resolving" // the one cross-fade: shop interior → scrub frame 0
  | "result" // win/lose card, sitting on frame 0
  | "closing" // card (and, on a mid-round skip, the game) fades off
  | "done";

export default function IntroGame({ settings }: { settings?: GameSettings }) {
  const pathname = usePathname();
  const difficulty = settings?.difficulty ?? { desktop: DESKTOP_TUNING, mobile: MOBILE_TUNING };
  // When the offer is off, the server never serializes the code at all.
  const offer = settings?.offer ?? { enabled: false as const };
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<"won" | "lost" | null>(null);
  const [fine, setFine] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastHits, setLastHits] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<ArcadeState | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const artRef = useRef<GameArt | null>(null);
  const lookRef = useRef({ x: 0, y: 0 });
  const lookTargetRef = useRef({ x: 0, y: 0 });
  const pointerRef = useRef<Pointer>({ x: 0, y: 0, type: "", inside: false });
  const rafRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const coarseRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  // Decide once, after hydration, whether to show the game at all.
  useEffect(() => {
    if (phaseRef.current !== "idle") return;
    // Never over the admin — the owner is here to work, not to play.
    if (pathname.startsWith("/admin")) {
      setPhase("done");
      return;
    }
    const force = new URLSearchParams(window.location.search).get("intro") === "1";
    const seen = window.localStorage.getItem(SEEN_KEY) === "1";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || (seen && !force)) {
      setPhase("done");
      return;
    }
    coarseRef.current = window.matchMedia("(pointer: coarse)").matches;
    setFine(!coarseRef.current);
    // The ending resolves onto the hero's frame 0, so the overlay has to be
    // sitting exactly on top of it for its whole life.
    window.scrollTo(0, 0);
    startedAtRef.current = performance.now();
    setPhase("loading");
  }, [pathname]);

  // Preload every asset before the round starts. Any failure skips the
  // game entirely — the site is never blocked by missing art.
  useEffect(() => {
    if (phase !== "loading") return;
    let cancelled = false;
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    loadGameArt(portrait)
      .then((art) => {
        if (cancelled) return;
        artRef.current = art;
        setPhase("arcade");
      })
      .catch(() => {
        if (!cancelled) setPhase("done");
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const markSeen = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage unavailable — the game just shows again next visit
    }
  };

  // Both exits are the same move: fade what's on screen off the hero's
  // frame 0 and unmount. Mid-round that fades the shop interior; from the
  // result card it fades only the card, because the interior is already
  // gone. Either way the image underneath is untouched.
  const close = useCallback(() => {
    markSeen();
    window.scrollTo(0, 0);
    whenHeroPainted(() => {
      seqLog("closing: fading off frame 0");
      setPhase("closing");
    });
  }, []);

  const skip = useCallback(() => {
    track("intro_skipped", {
      elapsed_ms: Math.round(performance.now() - startedAtRef.current),
    });
    close();
  }, [close]);

  const retry = useCallback(() => {
    const state = stateRef.current;
    const scene = sceneRef.current;
    if (state && scene) {
      stateRef.current = createArcade(
        state.w,
        state.h,
        coarseRef.current ? difficulty.mobile : difficulty.desktop,
        scene.spawnPoints,
      );
    }
    setCopied(false);
    setOutcome(null);
    setPhase("arcade");
  }, []);

  // --- tiny synth ----------------------------------------------------------
  const sound = (kind: "shot" | "hit" | "reload" | "win" | "dry") => {
    try {
      audioRef.current ??= new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      const tone = (
        type: OscillatorType,
        f0: number,
        f1: number,
        dur: number,
        gain: number,
        at = 0,
      ) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0 + at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + at + dur);
        g.gain.setValueAtTime(gain, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur + 0.03);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + dur + 0.05);
      };
      if (kind === "shot") tone("sawtooth", 190, 42, 0.09, 0.07);
      else if (kind === "hit") tone("square", 520, 110, 0.09, 0.05);
      else if (kind === "dry") tone("square", 950, 700, 0.03, 0.03);
      else if (kind === "reload") {
        tone("square", 720, 500, 0.04, 0.04);
        tone("square", 880, 620, 0.04, 0.04, (700 - 120) / 1000);
      } else tone("square", 440, 1760, 0.24, 0.05);
    } catch {
      // audio is a garnish; never let it break the game
    }
  };

  // --- game lifecycle ------------------------------------------------------
  useEffect(() => {
    if (phase !== "arcade") return;
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tuning = coarseRef.current ? difficulty.mobile : difficulty.desktop;

    const size = () => {
      const art = artRef.current;
      if (!art) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sceneRef.current = buildScene(art, w, h);
      if (stateRef.current) {
        resizeArcade(stateRef.current, w, h, sceneRef.current.spawnPoints);
      } else {
        stateRef.current = createArcade(w, h, tuning, sceneRef.current.spawnPoints);
      }
    };
    const onResize = () => {
      const art = artRef.current;
      if (!art) return;
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      if (portrait !== art.portrait) {
        // orientation flipped: reload the matching background, then rebuild
        loadBackground(portrait)
          .then((bg) => {
            artRef.current = { ...art, bg, portrait };
            size();
          })
          .catch(() => size()); // keep the old background rather than dying
      } else {
        size();
      }
    };
    if (!stateRef.current || !sceneRef.current) {
      stateRef.current = null;
      size();
    }

    const frame = (now: number) => {
      const state = stateRef.current;
      const scene = sceneRef.current;
      if (!state || !scene) return;
      if (lastRef.current === null) lastRef.current = now;
      accRef.current = Math.min(accRef.current + (now - lastRef.current) / 1000, 0.25);
      lastRef.current = now;
      while (accRef.current >= STEP) {
        update(state, STEP);
        accRef.current -= STEP;
      }
      // mouse-look: layers ease toward the cursor (desktop only)
      lookRef.current.x +=
        (lookTargetRef.current.x - lookRef.current.x) * PARALLAX.smoothing;
      lookRef.current.y +=
        (lookTargetRef.current.y - lookRef.current.y) * PARALLAX.smoothing;
      const fx: ViewFx = {
        lookX: coarseRef.current ? 0 : lookRef.current.x,
        lookY: coarseRef.current ? 0 : lookRef.current.y,
        parallax: !coarseRef.current,
      };
      renderFrame(ctx, state, scene, pointerRef.current, fx);

      if (state.phase === "won" || state.phase === "lost") {
        setLastHits(state.hits);
        markSeen();
        track("intro_completed", {
          hits: state.hits,
          elapsed_ms: Math.round(performance.now() - startedAtRef.current),
        });
        const mode = coarseRef.current ? "mobile" : "desktop";
        void recordGameEvent("played", mode);
        if (state.phase === "won") {
          sound("win");
          void recordGameEvent("won", mode);
        }
        setOutcome(state.phase);
        // The cross-fade needs frame 0 already under us. It normally has
        // been since the first seconds of the round; if not, the last game
        // frame simply holds a beat rather than resolving onto nothing.
        whenHeroPainted(() => {
          seqLog("round over: cross-fading the interior into frame 0");
          setPhase("resolving");
        });
        return; // stop the loop; the last frame is what fades out
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY, type: e.pointerType, inside: true };
      lookTargetRef.current = {
        x: e.clientX - window.innerWidth / 2,
        y: e.clientY - window.innerHeight / 2,
      };
    };
    const onPointerLeave = () => {
      pointerRef.current.inside = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      const state = stateRef.current;
      if (!state || phaseRef.current !== "arcade") return;
      if (e.target instanceof Node && skipRef.current?.contains(e.target)) return;
      pointerRef.current = { x: e.clientX, y: e.clientY, type: e.pointerType, inside: true };
      const touch = e.pointerType === "touch" || coarseRef.current;
      if (touch) addRipple(state, e.clientX, e.clientY);
      const before = state.ammo;
      const result: ShotResult = fire(state, e.clientX, e.clientY);
      if (result === "hit") {
        sound("shot");
        sound("hit");
      } else if (result === "miss") {
        sound("shot");
      } else if (result === "reloading") {
        sound("dry");
      }
      if (before === 1 && (result === "hit" || result === "miss") && state.reloadUntil > 0) {
        sound("reload");
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (e.key === "Tab") {
        e.preventDefault();
        skipRef.current?.focus();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        lastRef.current = null;
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    overlay.addEventListener("pointermove", onPointerMove);
    overlay.addEventListener("pointerleave", onPointerLeave);
    overlay.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    skipRef.current?.focus();

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
      overlay.removeEventListener("pointermove", onPointerMove);
      overlay.removeEventListener("pointerleave", onPointerLeave);
      overlay.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, skip]);

  // Body scroll stays locked for the overlay's whole lifetime — otherwise
  // scrolling behind the game advances the hero scrub underneath, and the
  // site would be revealed mid-sequence.
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    // html AND body: overflow on body alone doesn't stop window scrolling
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [phase]);

  // Result screen and loading: Esc still skips, focus stays inside.
  useEffect(() => {
    if (phase !== "result" && phase !== "loading") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (e.key === "Tab") {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const focusables = Array.from(overlay.querySelectorAll<HTMLElement>("button"));
        if (focusables.length === 0) return;
        e.preventDefault();
        const index = focusables.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? (index - 1 + focusables.length) % focusables.length
          : (index + 1) % focusables.length;
        focusables[next].focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, skip]);

  // Once the interior has finished dissolving into frame 0, the result card
  // comes up on top of it.
  useEffect(() => {
    if (phase !== "resolving") return;
    const id = window.setTimeout(() => setPhase("result"), CROSSFADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Closing: whatever is still on screen fades off frame 0, then the
  // overlay unmounts. No wipe — the image underneath is already the site.
  useEffect(() => {
    if (phase !== "closing") return;
    const id = window.setTimeout(() => {
      seqLog("overlay unmounting (image underneath unchanged)");
      setPhase("done");
    }, CROSSFADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      void audioRef.current?.close().catch(() => {});
    };
  }, []);

  const copyCode = async () => {
    if (!offer.enabled) return;
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      void recordGameEvent("code_copied", coarseRef.current ? "mobile" : "desktop");
    } catch {
      // clipboard unavailable — the code is on screen either way
    }
  };

  if (phase === "idle" || phase === "done") return null;

  const tuning = coarseRef.current ? difficulty.mobile : difficulty.desktop;

  const playing = phase === "loading" || phase === "arcade";
  const fade = { transition: `opacity ${CROSSFADE_MS}ms linear` };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Intro game: clear the round, or skip"
      className={`intro-overlay${fine ? " intro-fine" : ""}`}
      // once the round has resolved onto frame 0 there is nothing left to
      // block: closing hands the page over before the card has finished
      // fading, so the site is live under the player's finger
      style={phase === "closing" ? { pointerEvents: "none" } : undefined}
    >
      {/* The shop interior. The only transition in the ending: this layer
          dissolves into the hero scrub's frame 0, already painted behind
          the overlay. Everything below sits on that image and never
          replaces it. */}
      <div
        className="intro-game-layer"
        style={{ ...fade, opacity: playing ? 1 : 0 }}
        aria-hidden={!playing}
      >
        <canvas ref={canvasRef} className="intro-canvas" aria-hidden="true" />
        <div className="intro-scanlines" aria-hidden="true" />
      </div>

      {phase === "loading" && (
        <div className="intro-result" aria-label="Loading">
          <p className="label text-muted">Loading</p>
          <div className="intro-loadbar mt-6" aria-hidden="true">
            <span />
          </div>
        </div>
      )}

      {outcome && (phase === "result" || phase === "closing") && (
        <div
          className="intro-result intro-card"
          style={{ ...fade, opacity: phase === "closing" ? 0 : 1 }}
        >
          {outcome === "won" ? (
            <>
              <p className="label text-acid">Cleared</p>
              {offer.enabled ? (
                <>
                  <h2 className="display mt-4 text-center text-3xl sm:text-4xl">
                    {offer.value.toUpperCase()}
                  </h2>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="intro-code mt-8"
                    aria-live="polite"
                  >
                    <span className="font-extrabold tracking-[0.2em]">{offer.code}</span>
                    <span className="label mt-2 block text-muted">
                      {copied ? "Copied" : "Tap to copy"}
                    </span>
                  </button>
                  <p className="mt-6 max-w-xs text-center text-xs text-muted">
                    {offer.note}
                  </p>
                  {offer.expires && (
                    <p className="label mt-3 text-muted">
                      Through{" "}
                      {new Date(offer.expires + "T12:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </>
              ) : (
                <h2 className="display mt-4 text-center text-3xl sm:text-4xl">
                  YOU CLEARED IT.
                </h2>
              )}
              <button type="button" onClick={close} className="cta-primary mt-10">
                Continue
              </button>
            </>
          ) : (
            <>
              <p className="label text-danger">Time</p>
              <h2 className="display mt-4 text-center text-3xl sm:text-4xl">NICE TRY.</h2>
              <p className="label mt-4 text-muted">
                {lastHits} of {tuning.targetCount} in{" "}
                {(tuning.roundMs / 1000).toFixed(0)} seconds
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                <button type="button" onClick={retry} className="cta-primary">
                  Retry
                </button>
                <button type="button" onClick={close} className="cta-secondary">
                  Continue
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {playing && (
        <button
          ref={skipRef}
          type="button"
          onClick={skip}
          className="label absolute top-4 right-4 min-w-11 min-h-11 px-4 py-3 border hairline bg-ink/60 text-muted hover:text-bone hover:border-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid transition-colors"
        >
          SKIP ✕
        </button>
      )}
    </div>
  );
}
