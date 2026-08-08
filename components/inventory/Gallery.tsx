"use client";

// Item gallery — DESIGN.md section 4. Desktop: fills the sticky 50vw
// panel, thumbnails pinned bottom-left, 200ms cross-fade on swap.
// Mobile: full-bleed swipeable carousel with indicators at the top.

import { useRef, useState } from "react";
import Image from "next/image";

export default function Gallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const [mobileActive, setMobileActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setMobileActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (images.length === 0) {
    return <div className="h-[55vh] bg-surface-2 lg:h-full" />;
  }

  return (
    <>
      {/* Desktop: stacked cross-fade + vertical thumb strip */}
      <div className="relative hidden h-full lg:block">
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === active ? alt : ""}
            fill
            priority={i === 0}
            sizes="50vw"
            className="object-cover"
            style={{ opacity: i === active ? 1 : 0, transition: "opacity 200ms" }}
          />
        ))}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-6 flex flex-col gap-2">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Image ${i + 1}`}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                className={`relative h-14 w-14 overflow-hidden border transition-opacity ${
                  i === active
                    ? "border-acid opacity-100"
                    : "hairline opacity-60 hover:opacity-100"
                }`}
              >
                <Image src={src} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: scroll-snap carousel, dashes (not dots — no pills) on top */}
      <div className="relative lg:hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <div key={src} className="relative aspect-[4/3] w-full shrink-0 snap-center">
              <Image
                src={src}
                alt={`${alt} — image ${i + 1}`}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute inset-x-0 top-4 flex justify-center gap-2">
            {images.map((src, i) => (
              <span
                key={src}
                className={`h-0.5 w-6 transition-colors ${
                  i === mobileActive ? "bg-acid" : "bg-bone/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
