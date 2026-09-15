// The design system, restated a third time — for PDF.
//
// There is no CSS here and no cascade. `@react-pdf/renderer` has its own
// layout engine with its own small subset of style properties, so the
// site's classes cannot be reused and the scale has to be transcribed
// into its primitives. DESIGN.md is still the source; this file is the
// transcription, the same job `lib/email/theme.ts` does for mail.
//
// TWO CONVERSIONS TO KNOW ABOUT
//
// Points, not pixels. A PDF point is 1/72 inch and the browser's CSS
// pixel is 1/96, so every size here is the site's px figure times 0.75.
// An 11px label is 8.25pt. Getting this wrong by using the px numbers
// directly is how a PDF comes out a third too big.
//
// Letter-spacing is absolute, not relative. The site tracks its display
// type at -0.035em and its labels at 0.28em, both of which scale with the
// font. `letterSpacing` in react-pdf is a flat number of points, so each
// size has to carry its own figure — computed below rather than typed in,
// so the relationship survives somebody changing a size.

/** px → pt. The site's numbers stay readable next to their source. */
export const pt = (px: number) => px * 0.75;

/** The site's tracking figures, from globals.css. */
const TRACK_DISPLAY = -0.035;
const TRACK_LABEL = 0.28;

/** Tracking in points, for a given size in points. */
export const displayTracking = (size: number) => size * TRACK_DISPLAY;
export const labelTracking = (size: number) => size * TRACK_LABEL;

/**
 * The palette, dark.
 *
 * A DECISION WORTH KNOWING ABOUT: the guide is dark, like the site and
 * like the email, rather than white like a document. It is delivered as a
 * link and read on a phone, which is where a dark page looks like the
 * brand and a white one looks like an invoice.
 *
 * The cost is printing. Somebody who sends this to a printer gets a page
 * of ink. If that turns out to matter, this object is the only thing that
 * has to change — swap `ink` and `bone`, darken `muted`, and every page
 * below follows.
 */
export const GUIDE_COLORS = {
  ink: "#0b0a0c",
  surface: "#131417",
  surface2: "#1b1d21",
  bone: "#f2efe7",
  /** The email's muted rather than the site's: it has to hold up at 8pt. */
  muted: "#9a9b9f",
  acid: "#57b94a",
  amber: "#c08a2e",
  rule: "#2a2c30",
} as const;

/** US Letter, because the shop is in El Paso. */
export const PAGE_SIZE = "LETTER" as const;

/** Page margins in points. Wide, because the type is set to hang. */
export const MARGIN = { top: pt(56), bottom: pt(64), side: pt(56) } as const;

/**
 * The type scale, in points.
 *
 * No `fontFamily` in here on purpose. Which family is available is a
 * runtime question — see `lib/guides/fonts.ts`, which falls back to a
 * built-in when the Archivo files cannot be read — so the document mixes
 * the family in rather than these entries naming one that may not exist.
 */
export const TYPE = {
  /** The one headline on the cover. */
  hero: {
    fontWeight: 800,
    fontSize: pt(44),
    lineHeight: 0.95,
    letterSpacing: displayTracking(pt(44)),
  },
  /** Section headings. */
  heading: {
    fontWeight: 800,
    fontSize: pt(26),
    lineHeight: 1.0,
    letterSpacing: displayTracking(pt(26)),
  },
  /** The 11px uppercase label. The most recognisable thing on the site. */
  label: {
    fontWeight: 600,
    fontSize: pt(11),
    lineHeight: 1.4,
    letterSpacing: labelTracking(pt(11)),
    textTransform: "uppercase",
  },
  body: {
    fontWeight: 400,
    fontSize: pt(13),
    lineHeight: 1.65,
  },
  small: {
    fontWeight: 400,
    fontSize: pt(11),
    lineHeight: 1.6,
  },
  /** Legal print. Smaller than anything else, and still legible. */
  fine: {
    fontWeight: 400,
    fontSize: pt(9),
    lineHeight: 1.55,
  },
} as const;
