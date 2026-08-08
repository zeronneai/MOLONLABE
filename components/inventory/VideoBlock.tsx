"use client";

// Lazy video: poster + play overlay until tapped, then a native <video>.
// Sits high on the detail page — video is the selling tool on this site.

import { useState } from "react";
import Image from "next/image";

export default function VideoBlock({
  src,
  poster,
  name,
}: {
  src: string;
  poster?: string;
  name: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video w-full bg-surface-2">
      {playing ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={src}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          controls
          autoPlay
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${name}`}
          className="group absolute inset-0"
        >
          {poster && (
            <Image
              src={poster}
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          )}
          <span className="absolute inset-0 bg-ink/30 transition-colors group-hover:bg-ink/15" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-bone transition-colors group-hover:border-acid">
            <svg
              viewBox="0 0 24 24"
              className="ml-0.5 h-5 w-5 fill-bone transition-colors group-hover:fill-acid"
              aria-hidden="true"
            >
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
          <span className="label absolute bottom-4 left-4 text-bone">
            Watch it run
          </span>
        </button>
      )}
    </div>
  );
}
