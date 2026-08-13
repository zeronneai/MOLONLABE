"use client";

// Age gate — PROJECT_BRIEF.md section 13. Not a hard legal control, but
// expected in this category, and the shop should not be showing firearms
// to someone who has said they are under 21.
//
// Order matters: it waits for the intro game to resolve, so the two
// overlays never stack and it never flashes over the game on a first
// visit. On a returning visit the game resolves immediately and the gate
// checks its own key, so a confirmed adult sees neither.

import { useEffect, useRef, useState } from "react";
import { LOGO_URL, SHOP_PHONE_DISPLAY, SHOP_PHONE_HREF } from "@/lib/brand";
import { whenIntroResolved } from "@/lib/intro/introSignal";

const KEY = "mlf_age_ok";
const MIN_AGE = 21;

type Phase = "waiting" | "asking" | "declined" | "passed";

export default function AgeGate() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Already confirmed: never ask again.
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(KEY);
    } catch {
      // private mode — we just ask again, which is the safe direction
    }
    if (stored === "1") {
      setPhase("passed");
      return;
    }
    return whenIntroResolved(() => setPhase("asking"));
  }, []);

  const open = phase === "asking" || phase === "declined";

  // Lock scrolling and trap focus for as long as the gate is up. Escape is
  // deliberately not a dismissal: this is a gate, not a dialog.
  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    confirmRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button, a[href]",
      );
      if (!focusables || focusables.length === 0) return;
      e.preventDefault();
      const list = Array.from(focusables);
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? (index - 1 + list.length) % list.length
        : (index + 1) % list.length;
      list[next].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, phase]);

  const confirm = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // storage unavailable — they'll be asked again next visit
    }
    setPhase("passed");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/95 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div ref={dialogRef} className="w-full max-w-md border hairline bg-surface p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="" className="h-10 w-auto" />

        {phase === "asking" ? (
          <>
            <h2 id="age-gate-title" className="display mt-8 text-2xl sm:text-3xl">
              ARE YOU {MIN_AGE} OR OLDER?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Everything here is sold in person through a licensed dealer,
              subject to federal, state and local law.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                ref={confirmRef}
                type="button"
                onClick={confirm}
                className="control control-go flex-1"
              >
                Yes, I&apos;m {MIN_AGE}+
              </button>
              <button
                type="button"
                onClick={() => setPhase("declined")}
                className="control flex-1"
              >
                No
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="age-gate-title" className="display mt-8 text-2xl sm:text-3xl">
              COME BACK WHEN YOU&apos;RE {MIN_AGE}.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              You have to be {MIN_AGE} to browse what&apos;s in the case. Nothing
              personal — it&apos;s the law we work under.
            </p>
            <div className="mt-8">
              <button
                ref={confirmRef}
                type="button"
                onClick={() => setPhase("asking")}
                className="control w-full"
              >
                I mistapped, take me back
              </button>
            </div>
            <p className="mt-6 text-sm text-muted">
              Questions?{" "}
              <a
                href={SHOP_PHONE_HREF}
                className="text-bone underline underline-offset-4 hover:text-acid"
              >
                {SHOP_PHONE_DISPLAY}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
