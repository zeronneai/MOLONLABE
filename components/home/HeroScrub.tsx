"use client";

// Scroll-scrubbed hero (supersedes DESIGN.md 2A's video loop). A sticky
// viewport inside a tall section; scroll progress picks a frame from the
// Cloudinary still sequence, eased on rAF so it never snaps. Copy lines
// surface at fixed progress windows; the headline lands last. Scrolling is
// never hijacked — the page always scrolls straight through.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FRAME_COUNT,
  LOOP_CROSSFADE_S,
  LOOP_PRELOAD_AT,
  SCRUB_SCROLL_VH,
  heroFrameUrl,
  heroLoopUrl,
} from "@/lib/hero/assets";
import { markHeroPainted, markHeroPresent, seqLog } from "@/lib/hero/paintSignal";
import { heroCopy } from "@/content/en";

type Status =
  | "boot" // deciding (pre-hydration paint shows the LCP frame + scrim)
  | "loading" // sequence preloading
  | "ready" // scrub live
  | "static"; // reduced motion or frame failure: final frame + headline

const EASE = 0.18; // per-frame interpolation toward the target frame
// frames decoded up-front (while the intro game plays) so the reveal is
// instant; the rest of the sequence streams in behind them
const PRIORITY_FRAMES = 8;

export default function HeroScrub() {
  const [status, setStatus] = useState<Status>("boot");
  const [portrait, setPortrait] = useState(false);
  const [loopReady, setLoopReady] = useState(false);
  // frame 0 is on the canvas — the intro overlay gates its wipe on this
  const [painted, setPainted] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Two stacked copies of the loop, offset in time: the standby fades in
  // over the last second of the active one's cycle so the restart jump
  // (the clips have no matching end frame) is never visible.
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const loopCtl = useRef({ primed: false, standbyPrimed: false, starting: false, active: 0, fading: false });
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const headlineRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef(0);
  const currentRef = useRef(0);
  const drawnRef = useRef(-1);
  const statusRef = useRef<Status>("boot");
  statusRef.current = status;

  // ---- handoff coordination with the intro overlay ------------------------
  useEffect(() => {
    markHeroPresent();
  }, []);
  useEffect(() => {
    // static fallback: the LCP <Image> is the visible hero — good enough
    if (status === "static") markHeroPainted();
  }, [status]);

  // ---- decide: reduced motion, and orientation (re-resolved on change) ----
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPortrait(window.matchMedia("(orientation: portrait)").matches);
      setStatus("static");
      return;
    }
    const mq = window.matchMedia("(orientation: portrait)");
    setPortrait(mq.matches);
    setStatus("loading");
    const onFlip = () => {
      setPortrait(mq.matches);
      setStatus("loading"); // reload the matching sequence
    };
    mq.addEventListener("change", onFlip);
    return () => mq.removeEventListener("change", onFlip);
  }, []);

  // ---- preload the sequence: frame 0 first, painted immediately -----------
  // The intro game usually covers this whole phase — frame 0 is decoded and
  // painted under the overlay long before the wipe can start, and the
  // overlay gates on that paint via the signal.
  useEffect(() => {
    if (status !== "loading") return;
    let cancelled = false;

    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`hero frame failed: ${src}`));
        img.src = src;
      });
    // decode() so the first drawImage is a blit, not a decode stall —
    // that stall is exactly the seam a slow phone would show
    const loadDecoded = (src: string) =>
      load(src).then(async (img) => {
        try {
          await img.decode();
        } catch {
          // decode() can reject spuriously; the image is still loaded
        }
        return img;
      });

    const urls = Array.from({ length: FRAME_COUNT }, (_, i) =>
      heroFrameUrl(portrait, i),
    );

    const paintFirst = (img: HTMLImageElement) => {
      framesRef.current[0] = img;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        drawnRef.current = 0;
      }
      setPainted(true);
      seqLog("hero frame 0 painted to canvas");
      markHeroPainted();
    };

    // frame 0 lands, decodes and paints before anything else is requested;
    // then the verification pair + priority head; then the full sequence.
    // A wrong clip duration or broken transform still fails loudly (the
    // mid/last verification) before the remaining 90+ frames are fetched.
    loadDecoded(urls[0])
      .then((first) => {
        if (cancelled) return Promise.reject(new Error("cancelled"));
        paintFirst(first);
        return Promise.all([
          loadDecoded(urls[Math.floor(FRAME_COUNT / 2)]),
          loadDecoded(urls[FRAME_COUNT - 1]),
          ...urls.slice(1, PRIORITY_FRAMES).map(loadDecoded),
        ]);
      })
      .then(() => Promise.allSettled(urls.map(load)))
      .then((settled) => {
        if (cancelled) return;
        const failed = settled.filter((s) => s.status === "rejected").length;
        if (failed > FRAME_COUNT * 0.05) {
          throw new Error(`hero sequence: ${failed}/${FRAME_COUNT} frames failed`);
        }
        const frames: HTMLImageElement[] = [];
        settled.forEach((s, i) => {
          frames[i] =
            s.status === "fulfilled" ? s.value : frames[i - 1]; // neighbour fills a rare gap
        });
        framesRef.current = frames;
        drawnRef.current = -1;
        seqLog("hero sequence fully loaded — scrub ready");
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled || err.message === "cancelled") return;
        console.error("[hero] scrub disabled, using static fallback:", err);
        setStatus("static");
      });

    return () => {
      cancelled = true;
    };
  }, [status, portrait]);

  // ---- scrub loop ---------------------------------------------------------
  const progress = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return 0;
    const rect = section.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, -rect.top / span));
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    loopCtl.current = { primed: false, standbyPrimed: false, starting: false, active: 0, fading: false };

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawnRef.current = -1;
    };
    size();
    window.addEventListener("resize", size);

    const draw = (index: number) => {
      const img = framesRef.current[index];
      if (!img) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      drawnRef.current = index;
    };

    const frame = () => {
      const p = progress();
      const target = p * (FRAME_COUNT - 1);
      currentRef.current += (target - currentRef.current) * EASE;
      if (Math.abs(target - currentRef.current) < 0.5) currentRef.current = target;
      const index = Math.round(currentRef.current);
      if (index !== drawnRef.current) draw(index);

      // copy lines: fade in rising 12px, fade out; one at a time
      heroCopy.lines.forEach((line, i) => {
        const el = lineRefs.current[i];
        if (!el) return;
        const t = (p - line.from) / (line.to - line.from);
        let opacity = 0;
        let rise = 12;
        if (t > 0 && t < 1) {
          const fadeIn = Math.min(1, t / 0.25);
          const fadeOut = Math.min(1, (1 - t) / 0.25);
          opacity = Math.min(fadeIn, fadeOut);
          rise = (1 - Math.min(1, t / 0.25)) * 12;
        }
        el.style.opacity = String(opacity);
        el.style.transform = `translateY(${rise}px)`;
      });

      // headline lands over the last window
      const headline = headlineRef.current;
      if (headline) {
        const t = Math.min(1, Math.max(0, (p - 0.85) / 0.1));
        headline.style.opacity = String(t);
        headline.style.transform = `translateY(${(1 - t) * 12}px)`;
        headline.style.pointerEvents = t > 0.5 ? "auto" : "none";
      }

      // loop video takes over only when the scrub is complete
      const a = videoARef.current;
      const b = videoBRef.current;
      if (a && b) {
        const ctl = loopCtl.current;
        // start fetching only once the scrub is mostly done, so the loop
        // never competes with the frame sequence for bandwidth
        if (!ctl.primed && p >= LOOP_PRELOAD_AT) {
          ctl.primed = true;
          a.preload = "auto";
          a.load();
        }
        if (p >= 0.999) {
          if (!ctl.starting && a.paused && b.paused) {
            ctl.starting = true;
            a.play()
              .then(() => {
                // cross-fade over the held final scrub frame (~250ms, CSS)
                setLoopReady(true);
                if (!ctl.standbyPrimed) {
                  ctl.standbyPrimed = true;
                  b.preload = "auto";
                  b.load();
                }
              })
              .catch(() => {
                // autoplay refused (e.g. iOS Low Power): the final scrub
                // frame holds. starting stays true so this doesn't retry
                // every rAF — it resets if the user scrolls away and back.
                setLoopReady(false);
              });
          }
          // seam: fade the standby in over the active one's last second
          const act = ctl.active === 0 ? a : b;
          const nxt = ctl.active === 0 ? b : a;
          const dur = act.duration;
          if (!act.paused && Number.isFinite(dur) && dur > LOOP_CROSSFADE_S * 2) {
            const remain = dur - act.currentTime;
            if (remain <= LOOP_CROSSFADE_S) {
              if (nxt.paused) {
                nxt.currentTime = 0;
                nxt.play().catch(() => {});
              }
              nxt.style.zIndex = "2";
              act.style.zIndex = "1";
              nxt.style.opacity = String(
                Math.min(1, Math.max(0, 1 - remain / LOOP_CROSSFADE_S)),
              );
              ctl.fading = true;
            } else if (ctl.fading) {
              // the active element wrapped past its end — the standby has
              // fully taken over; make the swap official
              act.pause();
              act.currentTime = 0;
              act.style.opacity = "0";
              nxt.style.opacity = "1";
              ctl.active = ctl.active === 0 ? 1 : 0;
              ctl.fading = false;
            }
          }
        } else {
          // scrolled back up: hold the scrub, reset the pair to the top
          if (!a.paused || !b.paused) {
            a.pause();
            b.pause();
            a.currentTime = 0;
            b.currentTime = 0;
            a.style.opacity = "1";
            b.style.opacity = "0";
            ctl.active = 0;
            ctl.fading = false;
            setLoopReady(false);
          }
          ctl.starting = false;
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", size);
    };
  }, [status, progress]);

  // ---- render -------------------------------------------------------------
  const isStatic = status === "static";
  const scrollVh = portrait ? SCRUB_SCROLL_VH.mobile : SCRUB_SCROLL_VH.desktop;
  const firstFrame = heroFrameUrl(portrait, 0);
  const lastFrame = heroFrameUrl(portrait, FRAME_COUNT - 1);
  const loopSrc = heroLoopUrl(portrait);

  return (
    <section
      ref={sectionRef}
      style={{ height: isStatic ? "100svh" : `calc(100vh + ${scrollVh}vh)` }}
    >
      <div className="sticky top-0 h-svh overflow-hidden bg-ink">
        {/* LCP layer: the first frame (static fallback shows the last) */}
        <Image
          src={isStatic ? lastFrame : firstFrame}
          alt="Inside the Molon Labe showroom, seen through a rifle scope"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {!isStatic && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            style={{ opacity: painted || status === "ready" ? 1 : 0 }}
            aria-hidden="true"
          />
        )}

        {/* loop background once the scrub completes: the wrapper cross-fades
            over the held final scrub frame; inside it, two copies of the
            clip hand off to each other so the restart seam never shows.
            (native loop stays on each element purely as a fail-safe — the
            crossfade swap normally retires an element before its end) */}
        {loopSrc && !isStatic && (
          <div
            className="absolute inset-0 transition-opacity duration-[250ms]"
            style={{ opacity: loopReady ? 1 : 0 }}
            aria-hidden="true"
          >
            <video
              key={loopSrc + "-a"}
              ref={videoARef}
              src={loopSrc}
              muted
              loop
              playsInline
              preload="none"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: 1 }}
            />
            <video
              key={loopSrc + "-b"}
              ref={videoBRef}
              src={loopSrc}
              muted
              loop
              playsInline
              preload="none"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: 0 }}
            />
          </div>
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(11,10,12,0.55) 0%, rgba(11,10,12,0.1) 40%, rgba(11,10,12,0.85) 100%)",
          }}
          aria-hidden="true"
        />

        {/* scrub copy lines */}
        {!isStatic && (
          <div className="px-page absolute inset-x-0 top-[36%]">
            {heroCopy.lines.map((line, i) => (
              <p
                key={line.text}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                className="display absolute max-w-3xl text-[clamp(2rem,5vw,4rem)] text-bone"
                style={{ opacity: 0 }}
              >
                {portrait && line.mobileText ? line.mobileText : line.text}
              </p>
            ))}
          </div>
        )}

        {/* headline + CTAs, bottom left per DESIGN.md */}
        <div
          ref={headlineRef}
          className="px-page absolute inset-x-0 bottom-0 pb-14 sm:pb-20"
          style={isStatic ? undefined : { opacity: 0, pointerEvents: "none" }}
        >
          <p className="label text-acid">{heroCopy.label}</p>
          <h1 className="display mt-6 max-w-4xl text-[clamp(2.5rem,6vw,5.5rem)]">
            {heroCopy.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
            <Link href="/inventory" className="cta-primary">
              {heroCopy.primaryCta}
            </Link>
            <Link href="/featured" className="cta-secondary">
              {heroCopy.secondaryCta}
            </Link>
          </div>
        </div>

        {/* minimal preload state — no spinner; gone once frame 0 is up,
            so the reveal can never show a loading treatment */}
        {status === "loading" && !painted && (
          <div className="px-page absolute bottom-14 left-0" aria-live="polite">
            <p className="label text-muted">Loading</p>
            <div className="intro-loadbar mt-4">
              <span />
            </div>
          </div>
        )}

        {/* scroll indicator, bottom right, while the scrub is live */}
        {!isStatic && (
          <div className="pr-page absolute bottom-14 right-0 hidden sm:block">
            <div className="scroll-rule" aria-hidden="true" />
          </div>
        )}
      </div>
    </section>
  );
}
