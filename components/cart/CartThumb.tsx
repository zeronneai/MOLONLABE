"use client";

// A small square picture for a cart line.
//
// Always a filled square, never a broken image or an empty box: with no
// photo, or a photo that fails to load (a moved file, an offline CDN),
// it shows the shop's mark on a quiet ground instead. The placeholder is
// drawn, not fetched, so it cannot fail itself.

import { useState } from "react";
import Image from "next/image";

export default function CartThumb({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;

  return (
    <div
      className="relative h-16 w-16 shrink-0 overflow-hidden border hairline bg-surface-2 sm:h-[72px] sm:w-[72px]"
      data-cart-thumb={show ? "photo" : "placeholder"}
    >
      {show ? (
        <Image
          src={src as string}
          alt={label}
          fill
          sizes="72px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          role="img"
          aria-label={label}
          className="flex h-full w-full items-center justify-center"
        >
          <span aria-hidden="true" className="display text-[13px] tracking-[-0.02em] text-muted">
            MLF
          </span>
        </div>
      )}
    </div>
  );
}
