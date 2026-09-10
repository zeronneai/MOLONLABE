// The design system, restated for email.
//
// Hex literals rather than the CSS custom properties in globals.css,
// because custom properties do not survive email clients — Outlook's Word
// rendering engine ignores them outright. These are the same values;
// DESIGN.md section 1 is the source, and this file is a transcription of
// it that a mail client can read.
//
// Kept in one place so the email cannot drift from the site by a shade.

export const EMAIL_COLORS = {
  /** Page ground, behind the card. */
  ink: "#0b0a0c",
  /** The card itself. */
  surface: "#131417",
  /** Panels that sit on the card — totals, notices. */
  surface2: "#1b1d21",
  /** Body text. */
  bone: "#f2efe7",
  /** Secondary text. Passes AA on both surface and surface2. */
  muted: "#9a9b9f",
  /** The only accent. */
  acid: "#57b94a",
  /** Reserved for the one thing that must not be missed: collection. */
  amber: "#c08a2e",
  /** Hairlines. A solid stand-in for the site's translucent rule. */
  rule: "#2a2c30",
} as const;

/**
 * Archivo where the client allows a web font, and a clean sans everywhere
 * else. Gmail strips web fonts, so the fallback is what most people
 * actually see and it has to be chosen rather than inherited — hence
 * Helvetica Neue ahead of Arial, and no serif in the chain.
 */
export const FONT_STACK =
  "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * The 11px uppercase label from DESIGN.md section 2, as an inline style.
 * Letter-spacing in email is safest in px rather than em — Outlook
 * rounds em spacing unpredictably at small sizes.
 */
export const LABEL = `font-family:${FONT_STACK};font-size:11px;line-height:1.4;letter-spacing:3px;text-transform:uppercase;font-weight:700`;

/** Archivo 800 with the display tracking, for the one heading. */
export const DISPLAY = `font-family:${FONT_STACK};font-weight:800;letter-spacing:-1px`;

export const BODY = `font-family:${FONT_STACK};font-size:15px;line-height:1.6`;
export const SMALL = `font-family:${FONT_STACK};font-size:13px;line-height:1.6`;
