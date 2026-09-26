"use client";

// The draw presentation. This is content, not an admin function: it runs
// fullscreen, carries no navigation, and is designed to be filmed.
//
// It plays what rules clause 15 promises, in that order:
//
//   1. SETUP    the piece, the numbers, the owner's controls
//   2. ROSTER   every buyer, first name and last initial, with their
//               guide count and the total, page by page. Nothing sampled,
//               nothing left off: the video is the proof that everyone was
//               in. The spin cannot start until every page has been shown.
//   3. WHEEL    one wedge per buyer, sized by the guides they hold
//   4. RESULT   the winner, the winning guide number, the seed
//
// THE WHEEL REVEALS, IT DOES NOT DECIDE. Pressing Spin records the draw
// first (commitDraw: seeded selection over the sold guides, written to the
// database) and only then turns the wheel, which is steered to stop on
// the recorded winner. A failed animation can therefore never change a
// result, and a replay of a drawn drop shows the recorded result again.
//
// The draw is recorded at Spin, not at Start, so the roster comes first:
// if a viewer, or the owner, sees a buyer missing, nothing has been drawn
// yet. And the server refuses if the sold guides changed after the roster
// was shown, so the video always shows everybody in the draw.
//
// Privacy: every name arriving here is already first name plus last
// initial, built on the server (lib/draw/roster.ts). No email, phone or
// surname reaches this component.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { commitDraw } from "@/app/admin/actions";
import { LOGO_URL, SHOP_SHORT_NAME } from "@/lib/brand";
import { newSeed, selectWinner } from "@/lib/draw/select";
import {
  holderOf,
  landingRotation,
  paginate,
  rosterTotal,
  segmentAtRotation,
  wheelSegments,
  type RosterEntry,
  type WheelSegment,
} from "@/lib/draw/roster";
import {
  CONTROLS_HIDE_MS,
  ROSTER_LARGE_MAX,
  ROSTER_LAYOUT,
  ROSTER_MIN_MS,
  ROSTER_PAGE_MS,
  SPIN_MS,
  WHEEL_TURNS,
  rehearsalRoster,
  wheelEase,
  type Orientation,
  type Reveal,
} from "@/lib/draw/presentation";

type Phase = "setup" | "roster" | "spin" | "lock";

/**
 * Formatted in the shop's own timezone rather than the recording device's.
 * A timestamp on a broadcast proof line is only useful if it means the
 * same thing to everyone watching it.
 */
function stamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// ------------------------------------------------------------- the wheel

/** Point on a circle, degrees clockwise from the top. */
function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

function wedgePath(seg: WheelSegment, r: number): string {
  if (seg.end - seg.start >= 359.999) {
    return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  }
  const [x1, y1] = polar(r, seg.start);
  const [x2, y2] = polar(r, seg.end);
  const large = seg.end - seg.start > 180 ? 1 : 0;
  return `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

const R = 100;

/**
 * The wheel itself. Wedges alternate bone and ink so neighbours never
 * merge on a compressed video; a name is written into its wedge when the
 * wedge is wide enough to hold it legibly, and the large readout under
 * the pointer names whoever is under it at every moment either way.
 */
function Wheel({ segments, winnerKey }: { segments: WheelSegment[]; winnerKey: string | null }) {
  return (
    <svg viewBox="-102 -102 204 204" className="draw-wheel-svg" aria-hidden="true">
      {segments.map((seg, i) => {
        const win = winnerKey === seg.key;
        const light = i % 2 === 0;
        const span = seg.end - seg.start;
        const mid = (seg.start + seg.end) / 2;
        // A label needs enough arc for its height. Past that, the readout
        // carries the name.
        const labelled = span >= 5.5 && segments.length > 1;
        const size = Math.min(9, Math.max(3.2, (span / 360) * 2 * Math.PI * 62 * 0.55));
        const name = seg.label.length > 14 ? `${seg.label.slice(0, 13)}…` : seg.label;
        return (
          <g
            key={seg.key}
            data-wedge={seg.key}
            data-name={seg.name}
            data-start={seg.start}
            data-end={seg.end}
            data-winner={win ? "true" : undefined}
          >
            <path
              d={wedgePath(seg, R)}
              className={win ? "draw-wedge-win" : light ? "draw-wedge-light" : "draw-wedge-dark"}
            />
            {labelled && (
              <text
                transform={`rotate(${mid}) translate(0 ${-R * 0.58}) rotate(-90)`}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={size}
                className={win ? "draw-wedge-text-win" : light ? "draw-wedge-text-dark" : "draw-wedge-text-light"}
              >
                {name}
              </text>
            )}
          </g>
        );
      })}
      <circle r={R} className="draw-wheel-rim" />
      <circle r={9} className="draw-wheel-hub" />
    </svg>
  );
}

// ------------------------------------------------------------ the stage

export default function DrawStage({
  gameId,
  prizeName,
  prizeImage,
  closesLabel,
  roster,
  shownGuides,
  alreadyDrawn,
  unsoldSpots = 0,
}: {
  gameId: string;
  prizeName: string;
  prizeImage: string | null;
  closesLabel: string | null;
  /** Every buyer, redacted, with their guides. Built on the server. */
  roster: RosterEntry[];
  /** The sold guide numbers the roster was built from. */
  shownGuides: number[];
  alreadyDrawn: boolean;
  /**
   * Guides still unsold. A drop with any left cannot be drawn: the rules
   * say it runs until every guide is purchased. It can still be rehearsed.
   */
  unsoldSpots?: number;
}) {
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [rehearsal, setRehearsal] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [controlsOn, setControlsOn] = useState(false);
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());

  const stageRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);

  /**
   * Copy and Done are summoned rather than shown: anything standing on
   * the frame after the result ends up in the recording, and the hold on
   * the winner is the shot. Pointer movement or a key brings them back
   * for a few seconds.
   */
  const nudgeControls = useCallback(() => {
    setControlsOn(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsOn(false), CONTROLS_HIDE_MS);
  }, []);

  const holdControls = useCallback(() => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    setControlsOn(true);
  }, []);

  useEffect(
    () => () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  // Rehearsal swaps the whole roster for invented buyers and never calls
  // the server, so a practice run cannot record a winner.
  const activeRoster = useMemo<RosterEntry[]>(
    () => (rehearsal ? rehearsalRoster() : roster),
    [rehearsal, roster],
  );
  const unnamedCount = useMemo(() => activeRoster.filter((r) => !r.named).length, [activeRoster]);
  const activeEntries = useMemo(() => rosterTotal(activeRoster), [activeRoster]);
  const activeEntrants = activeRoster.length;
  // The roster must add up to what was sold. If it ever does not, the
  // spin is refused on screen: a proof that does not add up is not one.
  const totalsAgree = rehearsal || activeEntries === shownGuides.length;

  const large = activeRoster.length <= ROSTER_LARGE_MAX;
  // 16:9 is short: twelve large rows do not fit one column there.
  const layout = large
    ? orientation === "vertical"
      ? { cols: 1, rows: ROSTER_LARGE_MAX }
      : { cols: 2, rows: Math.ceil(ROSTER_LARGE_MAX / 2) }
    : ROSTER_LAYOUT[orientation];
  const pages = useMemo(
    () => paginate(activeRoster, layout.cols * layout.rows),
    [activeRoster, layout],
  );
  const segments = useMemo(() => wheelSegments(activeRoster), [activeRoster]);
  const lastPage = pages.length - 1;
  const allShown = seen.size >= pages.length;
  const spinReady = phase === "roster" && allShown && totalsAgree && !busy;

  // A page counts as shown once it has been on screen long enough to be
  // read in the recording, and turns by itself after that.
  useEffect(() => {
    if (phase !== "roster") return;
    const shown = window.setTimeout(
      () => setSeen((s) => (s.has(page) ? s : new Set(s).add(page))),
      ROSTER_MIN_MS,
    );
    const turn = window.setTimeout(
      () => setPage((p) => (p < lastPage ? p + 1 : p)),
      ROSTER_PAGE_MS,
    );
    return () => {
      window.clearTimeout(shown);
      window.clearTimeout(turn);
    };
  }, [phase, page, lastPage]);

  const start = useCallback(() => {
    setError(null);
    setCopied(false);
    setReveal(null);
    setPage(0);
    setSeen(new Set());
    setPhase("roster");
  }, []);

  const spin = useCallback(async () => {
    if (busy || !allShown || !totalsAgree) return;
    setError(null);

    let record: Omit<Reveal, "winnerKey" | "rotation">;
    if (rehearsal) {
      // Entirely local, and the same selection as a real draw: one entry
      // per guide, picked by a seed.
      const seed = newSeed();
      const guides = activeRoster.flatMap((r) => r.numbers);
      const picked = selectWinner(guides.map((n) => ({ id: String(n), weight: 1 })), seed);
      if (!picked) {
        setError("Rehearsal roster is empty.");
        return;
      }
      const number = Number(picked.entrantId);
      record = {
        name: holderOf(activeRoster, number)?.name ?? "",
        ticket: number,
        total: picked.total,
        seed,
        drawnAt: new Date().toISOString(),
      };
    } else {
      setBusy(true);
      const result = await commitDraw(gameId, shownGuides);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      record = {
        name: result.name,
        ticket: result.ticket,
        total: result.total,
        seed: result.seed,
        drawnAt: result.drawnAt,
      };
    }

    const holder = holderOf(activeRoster, record.ticket);
    if (!holder) {
      // Impossible while the server refuses a changed list, and said out
      // loud if it ever happens rather than spinning to somebody else.
      setError(
        `Guide #${record.ticket} won, but it is not on the roster that was shown. ` +
          "The result is recorded. Do not post this take; call Purple Roots.",
      );
      return;
    }
    setReveal({
      ...record,
      // The roster's name, not the recorded one: for a buyer who has not
      // agreed to be named on the broadcast it is their guide number, and
      // the reveal must not name somebody the roster did not.
      name: holder.name,
      winnerKey: holder.key,
      rotation: landingRotation(segments, holder.key, record.seed, WHEEL_TURNS),
    });

    // Reduced motion gets the result, not a shortened spin.
    const still =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPhase(still ? "lock" : "spin");
  }, [busy, allShown, totalsAgree, rehearsal, activeRoster, gameId, shownGuides, segments]);

  // Keys on the roster: arrows step pages (never faster than a page can
  // be shown), Space or Enter spins once every page has been.
  useEffect(() => {
    if (phase === "lock") {
      const onKey = () => nudgeControls();
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (phase !== "roster") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && seen.has(page) && page < lastPage) setPage(page + 1);
      else if (e.key === "ArrowLeft" && page > 0) setPage(page - 1);
      else if ((e.key === " " || e.key === "Enter") && spinReady) {
        e.preventDefault();
        void spin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, page, lastPage, seen, spinReady, spin, nudgeControls]);

  // The spin. Written straight to the DOM rather than through state: a
  // React render per frame is the one thing guaranteed to cost the 60fps
  // this has to hold on a phone.
  useEffect(() => {
    if (phase !== "spin" || !reveal) return;
    const wheel = wheelRef.current;
    const readout = readoutRef.current;
    if (!wheel || !readout) {
      setPhase("lock");
      return;
    }
    let raf = 0;
    let lastKey = "";
    const begin = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - begin) / SPIN_MS);
      const angle = reveal.rotation * wheelEase(t);
      wheel.style.transform = `rotate(${angle}deg)`;
      const under = segmentAtRotation(segments, angle);
      if (under && under.key !== lastKey) {
        lastKey = under.key;
        readout.textContent = under.name;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else setPhase("lock");
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, reveal, segments]);

  const summary = useCallback(() => {
    if (!reveal) return "";
    return [
      `WINNER: ${prizeName}`,
      "",
      reveal.name,
      "",
      `Winning guide #${reveal.ticket}`,
      `${reveal.total} ${reveal.total === 1 ? "guide" : "guides"} sold to ${activeEntrants} ${activeEntrants === 1 ? "buyer" : "buyers"}`,
      `Drawn ${stamp(reveal.drawnAt)} MT`,
      `Seed ${reveal.seed}`,
      "",
      `Every guide was one entry. ${SHOP_SHORT_NAME}`,
    ].join("\n");
  }, [reveal, prizeName, activeEntrants]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setError("Could not reach the clipboard. Read the numbers off the screen.");
    }
  }, [summary]);

  const fullscreen = useCallback(() => {
    stageRef.current?.requestFullscreen?.().catch(() => {
      // Denied or unsupported; the layout is identical either way.
    });
  }, []);

  const reset = useCallback(() => {
    setPhase("setup");
    setReveal(null);
    setCopied(false);
    setError(null);
  }, []);

  const firstIndex = pages.slice(0, page).reduce((n, p) => n + p.length, 0);

  return (
    <div className="draw-stage" ref={stageRef}>
      <div
        className="draw-frame"
        data-orientation={orientation}
        data-phase={phase}
        data-controls={controlsOn ? "on" : "off"}
        onPointerMove={phase === "lock" ? nudgeControls : undefined}
        onPointerDown={phase === "lock" ? nudgeControls : undefined}
      >
        {/* Corner mark. Present in every phase: it is the only branding
            on screen and it needs to survive a crop. */}
        <div className="draw-mark">
          <Image src={LOGO_URL} alt="" width={96} height={96} priority />
        </div>

        {rehearsal && (
          <p className="draw-badge label">Rehearsal · nothing is recorded</p>
        )}

        {/* ---------------------------------------------------------- 1 */}
        {phase === "setup" && (
          <div className="draw-setup">
            <div className="draw-prize">
              {prizeImage ? (
                <Image
                  src={prizeImage}
                  alt=""
                  fill
                  sizes="(orientation: portrait) 70vw, 40vh"
                  className="object-cover"
                  priority
                />
              ) : (
                <span className="label draw-prize-empty">No prize image</span>
              )}
            </div>

            <div className="draw-copy">
              <p className="draw-eyebrow label">The Draw</p>
              <h1 className="draw-title display">{prizeName.toUpperCase()}</h1>

              <dl className="draw-stats">
                <div>
                  <dt className="label">Guides sold</dt>
                  <dd>{activeEntries.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="label">Buyers</dt>
                  <dd>{activeEntrants.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="label">Closed</dt>
                  <dd>{rehearsal ? "Rehearsal" : closesLabel ?? "·"}</dd>
                </div>
              </dl>

              {alreadyDrawn && !rehearsal && (
                <p className="draw-note">
                  This drop already has a winner. Starting shows the roster and
                  replays the recorded result. It will not draw again.
                </p>
              )}

              {!alreadyDrawn && !rehearsal && unsoldSpots > 0 && (
                <p className="draw-note draw-note-caution" data-not-sold-out>
                  <strong>{unsoldSpots}</strong> of{" "}
                  <strong>{unsoldSpots + activeEntries}</strong> guides are
                  still unsold. A drop is drawn once every guide sells.
                  Rehearsal works now.
                </p>
              )}

              {error && <p className="draw-error label">{error}</p>}

              <div className="draw-controls">
                <button
                  type="button"
                  onClick={start}
                  disabled={
                    activeEntries === 0 ||
                    (!alreadyDrawn && !rehearsal && unsoldSpots > 0)
                  }
                  className="control control-caution draw-start"
                >
                  {activeEntries === 0
                    ? "No guides sold"
                    : rehearsal
                      ? "Start rehearsal"
                      : alreadyDrawn
                        ? "Replay the draw"
                        : unsoldSpots > 0
                          ? "Not sold out"
                          : "Start the draw"}
                </button>

                <div className="seg draw-seg">
                  <button
                    type="button"
                    aria-pressed={orientation === "vertical"}
                    onClick={() => setOrientation("vertical")}
                    className="control control-sm"
                  >
                    9:16
                  </button>
                  <button
                    type="button"
                    aria-pressed={orientation === "horizontal"}
                    onClick={() => setOrientation("horizontal")}
                    className="control control-sm"
                  >
                    16:9
                  </button>
                </div>

                <div className="draw-minor">
                  <button
                    type="button"
                    aria-pressed={rehearsal}
                    onClick={() => setRehearsal((r) => !r)}
                    className="control control-sm tone-caution"
                  >
                    Rehearsal
                  </button>
                  <button type="button" onClick={fullscreen} className="control control-sm">
                    Fullscreen
                  </button>
                  <a href={`/admin/games/${gameId}`} className="control control-sm">
                    Exit
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- 2 */}
        {phase === "roster" && (
          <div className="draw-roster" data-roster-page={page + 1} data-roster-pages={pages.length}>
            <p className="draw-eyebrow label">Every entry · {prizeName}</p>
            <ol
              className="draw-roster-list"
              data-size={large ? "large" : undefined}
              style={{ "--cols": layout.cols, "--rows": layout.rows } as React.CSSProperties}
              start={firstIndex + 1}
            >
              {pages[page].map((r, i) => (
                <li key={r.key} data-roster-entry data-unnamed={r.named ? undefined : ""}>
                  <span className="draw-roster-n">{firstIndex + i + 1}</span>
                  <span className="draw-roster-name">{r.name}</span>
                  <span className="draw-roster-count">
                    {r.count} {r.count === 1 ? "guide" : "guides"}
                  </span>
                </li>
              ))}
            </ol>
            <div className="draw-roster-foot">
              <p data-roster-total className={totalsAgree ? "" : "draw-error"}>
                <strong>{activeEntrants.toLocaleString()}</strong>{" "}
                {activeEntrants === 1 ? "buyer" : "buyers"} ·{" "}
                <strong>{activeEntries.toLocaleString()}</strong>{" "}
                {activeEntries === 1 ? "guide" : "guides"}
                {!rehearsal && (
                  <>
                    {" "}
                    {totalsAgree ? "· all" : "· does not match the"}{" "}
                    <strong>{shownGuides.length.toLocaleString()}</strong> sold
                  </>
                )}
              </p>
              {unnamedCount > 0 && (
                <p className="label" data-roster-unnamed>
                  {unnamedCount} {unnamedCount === 1 ? "buyer is" : "buyers are"} shown by
                  guide number. They bought before names were shown on the drawing.
                </p>
              )}
              <p className="label">
                Page {page + 1} of {pages.length}
              </p>
              {error && <p className="draw-error label">{error}</p>}
              {spinReady && (
                <button
                  type="button"
                  onClick={() => void spin()}
                  className="control control-caution draw-spin-go"
                >
                  {busy ? "Drawing…" : "Spin the wheel"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------ 3 & 4 */}
        {(phase === "spin" || phase === "lock") && reveal && (
          <div className="draw-wheel-scene">
            <div className="draw-wheel-wrap">
              <div className="draw-pointer" aria-hidden="true" />
              <div
                ref={wheelRef}
                className="draw-wheel"
                data-rotation={phase === "lock" ? reveal.rotation : undefined}
                style={phase === "lock" ? { transform: `rotate(${reveal.rotation}deg)` } : undefined}
              >
                <Wheel segments={segments} winnerKey={phase === "lock" ? reveal.winnerKey : null} />
              </div>
            </div>
            <div className="draw-readout">
              <p className="draw-reveal-label label">{phase === "lock" ? "Winner" : "On the wheel"}</p>
              <div ref={readoutRef} className="draw-name display" data-readout>
                {phase === "lock" ? reveal.name : ""}
              </div>
            </div>
          </div>
        )}

        {phase === "lock" && reveal && (
          <div className="draw-record">
            <p>
              Winning guide <strong>#{reveal.ticket.toLocaleString()}</strong> ·{" "}
              {reveal.total.toLocaleString()} {reveal.total === 1 ? "guide" : "guides"} sold ·{" "}
              {stamp(reveal.drawnAt)} MT
            </p>
            <p>seed {reveal.seed}</p>
            {error && <p className="draw-error label">{error}</p>}
          </div>
        )}

        {/* Summoned, not shown: see nudgeControls. */}
        {phase === "lock" && reveal && (
          <div className="draw-after" onFocusCapture={holdControls} onBlurCapture={nudgeControls}>
            <button type="button" onClick={copy} className="control control-sm">
              {copied ? "Copied" : "Copy summary"}
            </button>
            <button type="button" onClick={reset} className="control control-sm">
              Done
            </button>
            <a href={`/admin/games/${gameId}`} className="control control-sm">
              Back to the drop
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
