"use client";

// Full-screen pixel shooting gallery shown on first visit.
// Remove the <IntroGame /> line in app/layout.tsx to drop the whole feature.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ALIEN_COUNT,
  STEP,
  addRipple,
  createGame,
  hitTest,
  killAlien,
  resizeGame,
  update,
  type GameState,
} from "@/lib/game/engine";
import { renderFrame, type Pointer } from "@/lib/game/render";
import { LOGO_URL } from "@/lib/brand";
import { track } from "@/lib/analytics";

const SEEN_KEY = "mlf_intro_seen";

type Phase = "idle" | "playing" | "wiping" | "done";

export default function IntroGame() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [flash, setFlash] = useState(false);
  const [skull, setSkull] = useState(false);
  const [fine, setFine] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const pointerRef = useRef<Pointer>({ x: 0, y: 0, type: "", inside: false });
  const rafRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const coarseRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const timeoutsRef = useRef<number[]>([]);
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
    // Warm the skull for the completion handoff so it appears instantly.
    new window.Image().src = LOGO_URL;
    startedAtRef.current = performance.now();
    setPhase("playing");
  }, [pathname]);

  const markSeen = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage unavailable (private mode) — the game just shows again next visit
    }
  };

  const skip = useCallback(() => {
    markSeen();
    track("intro_skipped", {
      elapsed_ms: Math.round(performance.now() - startedAtRef.current),
    });
    setPhase("done");
  }, []);

  const playBlip = (final: boolean) => {
    try {
      audioRef.current ??= new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      if (final) {
        osc.frequency.setValueAtTime(440, t0);
        osc.frequency.exponentialRampToValueAtTime(1760, t0 + 0.22);
      } else {
        osc.frequency.setValueAtTime(520, t0);
        osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.09);
      }
      gain.gain.setValueAtTime(0.05, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (final ? 0.28 : 0.12));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + (final ? 0.3 : 0.14));
    } catch {
      // audio is a garnish; never let it break the game
    }
  };

  // Game lifecycle: canvas, input, fixed-timestep loop.
  useEffect(() => {
    if (phase !== "playing" && phase !== "wiping") return;
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const timeouts = timeoutsRef.current;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stateRef.current) {
        resizeGame(stateRef.current, window.innerWidth, window.innerHeight);
      }
    };

    stateRef.current ??= createGame(window.innerWidth, window.innerHeight);
    size();

    const frame = (now: number) => {
      const state = stateRef.current;
      if (!state) return;
      if (lastRef.current === null) lastRef.current = now;
      // Fixed timestep so movement speed is identical across refresh rates.
      accRef.current = Math.min(accRef.current + (now - lastRef.current) / 1000, 0.25);
      lastRef.current = now;
      while (accRef.current >= STEP) {
        update(state, STEP);
        accRef.current -= STEP;
      }
      renderFrame(ctx, state, pointerRef.current);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
        inside: true,
      };
    };
    const onPointerLeave = () => {
      pointerRef.current.inside = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      const state = stateRef.current;
      if (!state || phaseRef.current !== "playing") return;
      // Shots aimed at the skip button are not shots.
      if (e.target instanceof Node && skipRef.current?.contains(e.target)) return;
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
        inside: true,
      };
      const touch = e.pointerType === "touch" || coarseRef.current;
      if (touch) addRipple(state, e.clientX, e.clientY);
      const hit = hitTest(state, e.clientX, e.clientY, touch);
      if (hit < 0) return;
      killAlien(state, hit);
      const finished = state.hits >= ALIEN_COUNT;
      playBlip(finished);
      if (finished) {
        markSeen();
        track("intro_completed", {
          hits: state.hits,
          elapsed_ms: Math.round(performance.now() - startedAtRef.current),
        });
        // Let the last burst breathe, flash, resolve the flash into the
        // skull for ~250ms, then the hard wipe carries it into the site.
        timeouts.push(
          window.setTimeout(() => setFlash(true), 260),
          window.setTimeout(() => setSkull(true), 330),
          window.setTimeout(() => setPhase("wiping"), 590),
        );
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (e.key === "Tab") {
        // The overlay traps focus; SKIP is the only focusable control.
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

    // Listeners live on the overlay (not the canvas) so the crosshair keeps
    // tracking across the SKIP button while the native cursor stays hidden.
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
      for (const id of timeouts) window.clearTimeout(id);
      timeouts.length = 0;
    };
  }, [phase, skip]);

  useEffect(() => {
    return () => {
      void audioRef.current?.close().catch(() => {});
    };
  }, []);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Intro: hit all four aliens, or skip"
      className={`intro-overlay${fine ? " intro-fine" : ""}${
        phase === "wiping" ? " intro-wiping" : ""
      }`}
      onAnimationEnd={(e) => {
        if (e.animationName === "intro-wipe") setPhase("done");
      }}
    >
      <canvas ref={canvasRef} className="intro-canvas" aria-hidden="true" />
      <div className="intro-scanlines" aria-hidden="true" />
      {skull && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_URL} alt="" className="intro-skull" aria-hidden="true" />
      )}
      {flash && <div className="intro-flash" aria-hidden="true" />}
      <button
        ref={skipRef}
        type="button"
        onClick={skip}
        className="label absolute top-4 right-4 min-w-11 min-h-11 px-4 py-3 border hairline text-muted hover:text-bone hover:border-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid transition-colors"
      >
        SKIP ✕
      </button>
    </div>
  );
}
