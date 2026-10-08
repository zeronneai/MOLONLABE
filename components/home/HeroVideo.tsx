"use client";

// The hero: the Molon Labe Recap playing muted and looping behind the
// headline. Vertical cut on a phone held upright, horizontal otherwise,
// switched if the phone is turned.
//
// It replaced a scroll-scrubbed 5-second clip. The recap runs 43 seconds
// with cuts, which reads as a slideshow when scrubbed, so it simply plays,
// and the headline and buttons are there from the first paint rather than
// arriving at the end of a scroll.
//
// The first frame, as a still, is what paints first (and is the LCP
// element). The video fades in over it once it is actually playing, so a
// slow connection or a refused autoplay (iOS Low Power Mode) shows the
// still, never a black box. Reduced motion or data saver: the still only.
// Off screen: paused, so it costs nothing while the visitor reads below.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { heroPosterUrl, heroVideoUrl } from "@/lib/hero/assets";
import { markHeroPainted, markHeroPresent, seqLog } from "@/lib/hero/paintSignal";
import { heroCopy } from "@/content/en";

type Mode =
  | "boot" // before hydration: the still, chosen by CSS media query
  | "video" // the recap, once it is known which cut to load
  | "still"; // reduced motion or data saver

export default function HeroVideo({
  feature = { href: "/games", label: "See the drops" },
}: {
  /**
   * Where the second button goes: the home page's drop, by its own
   * address, or the list of drops when none is featured.
   */
  feature?: { href: string; label: string };
} = {}) {
  const [mode, setMode] = useState<Mode>("boot");
  const [portrait, setPortrait] = useState(false);
  const [playing, setPlaying] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ---- handoff with the intro overlay: it waits for the hero to paint ----
  useEffect(() => {
    markHeroPresent();
    const img = posterRef.current;
    const done = () => {
      seqLog("hero still painted");
      markHeroPainted();
    };
    if (!img || img.complete) return done();
    // An error releases the overlay too: a missing still must not hold
    // the site behind the intro.
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    return () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
    };
  }, []);

  // ---- which cut, and whether to play at all ------------------------------
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const mq = window.matchMedia("(orientation: portrait)");
    setPortrait(mq.matches);
    setMode(reduce || saveData ? "still" : "video");
    const onFlip = () => {
      setPlaying(false);
      setPortrait(mq.matches);
    };
    mq.addEventListener("change", onFlip);
    return () => mq.removeEventListener("change", onFlip);
  }, []);

  // ---- play while on screen, pause while not ------------------------------
  useEffect(() => {
    if (mode !== "video") return;
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay refused: the still stays. Nothing to retry.
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(section);
    return () => io.disconnect();
  }, [mode, portrait]);

  const src = heroVideoUrl(portrait);

  return (
    <section ref={sectionRef} className="relative h-svh overflow-hidden bg-ink" data-hero>
      {/* The still: the right cut's first frame before any script runs. */}
      <picture>
        <source media="(orientation: portrait)" srcSet={heroPosterUrl(true)} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={posterRef}
          src={heroPosterUrl(false)}
          alt="Shooters on the range at a Molon Labe Firearms event"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          data-hero-poster
        />
      </picture>

      {mode === "video" && (
        <video
          key={src}
          ref={videoRef}
          src={src}
          poster={heroPosterUrl(portrait)}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: playing ? 1 : 0 }}
          data-hero-video
        />
      )}

      {/* Darker than the old dark-interior clip needed: the recap is mostly
          bright sky, under the menu at the top and the small label and the
          headline lower down. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,10,12,0.75) 0%, rgba(11,10,12,0.15) 26%, rgba(11,10,12,0.6) 58%, rgba(11,10,12,0.9) 100%)",
        }}
        aria-hidden="true"
      />

      {/* headline + CTAs, bottom left per DESIGN.md */}
      <div className="px-page absolute inset-x-0 bottom-0 pb-14 sm:pb-20">
        <p className="label text-acid">{heroCopy.label}</p>
        <h1 className="display mt-6 max-w-4xl text-[clamp(2.5rem,6vw,5.5rem)]">
          {heroCopy.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
          <Link href="/in-the-case" className="cta-primary control-go">
            {heroCopy.primaryCta}
          </Link>
          <Link href={feature.href} className="cta-secondary">
            {feature.label}
          </Link>
        </div>
      </div>

      {/* there is more below */}
      <div className="pr-page absolute bottom-14 right-0 hidden sm:block">
        <div className="scroll-rule" aria-hidden="true" />
      </div>
    </section>
  );
}
