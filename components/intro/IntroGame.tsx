"use client";

// First-person pixel shooting gallery shown on first visit.
// Remove the <IntroGame /> line in app/(site)/layout.tsx to drop the
// whole feature. All game logic lives in lib/game/.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DESKTOP_TUNING,
  DISCOUNT_PLACEHOLDER,
  MOBILE_TUNING,
  ROUND_MS,
} from "@/lib/game/config";
import {
  STEP,
  addRipple,
  cellSize,
  createArcade,
  fire,
  resizeArcade,
  update,
  type ArcadeState,
  type ShotResult,
} from "@/lib/game/engine";
import { buildScene, type Scene } from "@/lib/game/scene";
import { renderFrame, type Pointer } from "@/lib/game/render";
import { LOGO_URL } from "@/lib/brand";
import { track } from "@/lib/analytics";

const SEEN_KEY = "mlf_intro_seen";

type Phase = "idle" | "arcade" | "won" | "lost" | "handoff" | "wiping" | "done";

// TODO next step: replace with the owner-controlled settings table.
const discount = DISCOUNT_PLACEHOLDER;

export default function IntroGame() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [fine, setFine] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastHits, setLastHits] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<ArcadeState | null>(null);
  const sceneRef = useRef<Scene | null>(null);
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
    new window.Image().src = LOGO_URL; // warm the skull for the handoff
    startedAtRef.current = performance.now();
    setPhase("arcade");
  }, [pathname]);

  const markSeen = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage unavailable — the game just shows again next visit
    }
  };

  const skip = useCallback(() => {
    markSeen();
    track("intro_skipped", {
      elapsed_ms: Math.round(performance.now() - startedAtRef.current),
    });
    setPhase("done");
  }, []);

  const finishToSite = useCallback(() => {
    markSeen();
    setPhase("handoff");
  }, []);

  const retry = useCallback(() => {
    const state = stateRef.current;
    const scene = sceneRef.current;
    if (state && scene) {
      stateRef.current = createArcade(
        state.w,
        state.h,
        coarseRef.current ? MOBILE_TUNING : DESKTOP_TUNING,
        scene.spawnPoints,
      );
    }
    setCopied(false);
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

    const tuning = coarseRef.current ? MOBILE_TUNING : DESKTOP_TUNING;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sceneRef.current = buildScene(w, h, cellSize(w, h), dpr);
      if (stateRef.current) {
        resizeArcade(stateRef.current, w, h, sceneRef.current.spawnPoints);
      } else {
        stateRef.current = createArcade(w, h, tuning, sceneRef.current.spawnPoints);
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
      renderFrame(ctx, state, scene, pointerRef.current);

      if (state.phase === "won" || state.phase === "lost") {
        setLastHits(state.hits);
        markSeen();
        track("intro_completed", {
          hits: state.hits,
          elapsed_ms: Math.round(performance.now() - startedAtRef.current),
        });
        if (state.phase === "won") sound("win");
        setPhase(state.phase);
        return; // stop the loop; last frame stays behind the result card
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY, type: e.pointerType, inside: true };
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
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", onVisibility);

    skipRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
      overlay.removeEventListener("pointermove", onPointerMove);
      overlay.removeEventListener("pointerleave", onPointerLeave);
      overlay.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", onVisibility);
      document.body.style.overflow = prevOverflow;
    };
  }, [phase, skip]);

  // Result screens: Esc still skips, focus stays inside the overlay.
  useEffect(() => {
    if (phase !== "won" && phase !== "lost") return;
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [phase, skip]);

  // Skull handoff: brief beat, then the hard wipe.
  useEffect(() => {
    if (phase !== "handoff") return;
    const id = window.setTimeout(() => setPhase("wiping"), 320);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      void audioRef.current?.close().catch(() => {});
    };
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(discount.code);
      setCopied(true);
    } catch {
      // clipboard unavailable — the code is on screen either way
    }
  };

  if (phase === "idle" || phase === "done") return null;

  const tuning = coarseRef.current ? MOBILE_TUNING : DESKTOP_TUNING;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Intro game: clear the round, or skip"
      className={`intro-overlay${fine ? " intro-fine" : ""}${
        phase === "wiping" ? " intro-wiping" : ""
      }`}
      onAnimationEnd={(e) => {
        if (e.animationName === "intro-wipe") setPhase("done");
      }}
    >
      <canvas ref={canvasRef} className="intro-canvas" aria-hidden="true" />
      <div className="intro-scanlines" aria-hidden="true" />

      {phase === "won" && (
        <div className="intro-result">
          <p className="label text-acid">Cleared</p>
          {discount.enabled ? (
            <>
              <h2 className="display mt-4 text-center text-3xl sm:text-4xl">
                {discount.value}
              </h2>
              <button
                type="button"
                onClick={copyCode}
                className="intro-code mt-8"
                aria-live="polite"
              >
                <span className="font-extrabold tracking-[0.2em]">{discount.code}</span>
                <span className="label mt-2 block text-muted">
                  {copied ? "Copied" : "Tap to copy"}
                </span>
              </button>
              <p className="label mt-6 text-muted">{discount.expires}</p>
            </>
          ) : (
            <h2 className="display mt-4 text-center text-3xl sm:text-4xl">
              YOU CLEARED IT.
            </h2>
          )}
          <button type="button" onClick={finishToSite} className="cta-primary mt-10">
            Continue
          </button>
        </div>
      )}

      {phase === "lost" && (
        <div className="intro-result">
          <p className="label text-danger">Time</p>
          <h2 className="display mt-4 text-center text-3xl sm:text-4xl">NICE TRY.</h2>
          <p className="label mt-4 text-muted">
            {lastHits} of {tuning.targetCount} in {(ROUND_MS / 1000).toFixed(0)} seconds
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            <button type="button" onClick={retry} className="cta-primary">
              Retry
            </button>
            <button type="button" onClick={finishToSite} className="cta-secondary">
              Continue
            </button>
          </div>
        </div>
      )}

      {(phase === "handoff" || phase === "wiping") && (
        <div className="absolute inset-0 bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="" className="intro-skull" aria-hidden="true" />
        </div>
      )}

      {phase !== "handoff" && phase !== "wiping" && (
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
