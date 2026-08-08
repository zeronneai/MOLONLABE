"use client";

// The signature listing layout — DESIGN.md section 3. Full-width rows on
// desktop with a cursor-following image panel; stacked full-bleed blocks
// on mobile. No cards, no rounded corners.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export interface IndexItem {
  slug: string;
  name: string;
  category: string; // display label, e.g. "PISTOL"
  categoryKey: string; // raw db value, e.g. "pistol"
  status: "available" | "reserved" | "sold";
  image?: string;
}

const STATUS_COLOR: Record<IndexItem["status"], string> = {
  available: "text-acid",
  reserved: "text-muted",
  sold: "text-danger",
};

const PANEL_W = 340;
const PANEL_H = 420;
const LERP = 0.12;

export default function EditorialIndex({
  items,
  enterKey = 0,
  exiting = false,
}: {
  items: IndexItem[];
  /** bump to replay the staggered entrance (e.g. on filter change) */
  enterKey?: number;
  /** true while rows animate out before a filter swap */
  exiting?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [fine, setFine] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const activeRef = useRef<number | null>(null);
  activeRef.current = active;

  useEffect(() => {
    setFine(window.matchMedia("(pointer: fine)").matches);
  }, []);

  // The panel follows the cursor with a 0.12 lerp — it lags behind and
  // catches up, which is what makes it feel weighty rather than stuck on.
  useEffect(() => {
    if (!fine) return;
    const loop = () => {
      pos.current.x += (target.current.x - pos.current.x) * LERP;
      pos.current.y += (target.current.y - pos.current.y) * LERP;
      const el = panelRef.current;
      if (el) {
        el.style.transform = `translate(${pos.current.x - PANEL_W / 2}px, ${
          pos.current.y - PANEL_H / 2
        }px)`;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [fine]);

  const onMove = (e: React.PointerEvent) => {
    target.current = { x: e.clientX, y: e.clientY };
    if (activeRef.current === null) {
      // First entry: appear at the cursor rather than flying in from 0,0
      pos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const rowAnim = (i: number) =>
    exiting
      ? { className: "edx-out", style: { animationDelay: `${i * 15}ms` } }
      : { className: "edx-in", style: { animationDelay: `${i * 25}ms` } };

  return (
    <div className="edx" onPointerMove={fine ? onMove : undefined}>
      {/* Desktop rows */}
      <ul className="hidden border-t hairline md:block">
        {items.map((item, i) => {
          const anim = rowAnim(i);
          return (
            <li
              key={`${enterKey}-${item.slug}`}
              className={`edx-row border-b hairline ${anim.className}`}
              style={anim.style}
            >
              <Link
                href={`/inventory/${item.slug}`}
                className="grid h-24 grid-cols-[48px_1fr_140px_130px] items-center gap-4"
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
              >
                <span className="label text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="edx-name display text-[30px] text-bone/90">
                  {item.name.toUpperCase()}
                </span>
                <span className="label text-right text-muted">{item.category}</span>
                <span className="justify-self-end">
                  <span className={`chip ${STATUS_COLOR[item.status]}`}>
                    {item.status}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Cursor-following image panel */}
      {fine && (
        <div
          ref={panelRef}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-40 hidden md:block"
          style={{
            width: PANEL_W,
            height: PANEL_H,
            opacity: active === null ? 0 : 1,
            transition: "opacity 180ms",
          }}
        >
          {items.map((item, i) =>
            item.image ? (
              <Image
                key={item.slug}
                src={item.image}
                alt=""
                fill
                sizes="340px"
                className="object-cover"
                style={{ opacity: active === i ? 1 : 0, transition: "opacity 180ms" }}
              />
            ) : (
              <div
                key={item.slug}
                className="absolute inset-0 bg-surface-2"
                style={{ opacity: active === i ? 1 : 0, transition: "opacity 180ms" }}
              />
            ),
          )}
        </div>
      )}

      {/* Mobile: stacked full-bleed blocks, still hairlines, still no cards */}
      <ul className="md:hidden">
        {items.map((item, i) => {
          const anim = rowAnim(i);
          return (
            <li
              key={`${enterKey}-${item.slug}`}
              className={`border-b hairline py-6 ${anim.className}`}
              style={anim.style}
            >
              <Link href={`/inventory/${item.slug}`} className="block">
                <div className="bleed-x relative aspect-video">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-surface-2" />
                  )}
                </div>
                <div className="mt-4 flex items-baseline gap-4">
                  <span className="label text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="display text-2xl">{item.name.toUpperCase()}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="label text-muted">{item.category}</span>
                  <span className={`chip ${STATUS_COLOR[item.status]}`}>
                    {item.status}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
