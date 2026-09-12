// The buyer's confirmation, rendered as a pure function of the order.
//
// Pure on purpose: no database, no network, no clock. That makes the one
// piece of this flow with real legal content directly testable, and it
// means the same renderer can produce a preview without sending anything
// to anybody.
//
// ---------------------------------------------------------------------
// Email HTML is not web HTML. What this file does differently, and why:
//
//  * Tables for layout, `role="presentation"` so screen readers skip
//    them. Outlook renders through Word, which has no flexbox and no
//    grid.
//  * Every style inline. Gmail strips <style> from forwarded mail and
//    from the clipped view, so anything that matters cannot live there.
//    The <style> block carries only the dark-mode hints, which are
//    progressive.
//  * `bgcolor` attributes alongside `background-color`. Outlook drops the
//    CSS property on some elements and honours the attribute.
//  * Colours set on the same element as the text they sit behind. A
//    client that inverts one and not the other is how a dark email turns
//    into white-on-white.
//  * `color-scheme` declared so Apple Mail and iOS stop force-inverting.
//    We are already dark; their inversion is what breaks us.
//  * No background images, no web-font dependency for legibility, and a
//    text wordmark under the logo so a blocked image costs nothing.
//  * Under 102KB, which is where Gmail clips a message and hides
//    everything after the cut — including, here, the legal text.
// ---------------------------------------------------------------------

import { formatUsd } from "@/lib/money";
import {
  FIREARM_DISCLAIMER,
  PICKUP_NOTICE,
  REFUND_POLICY,
  SHIPPING_NOTICE,
} from "@/lib/legal";
import {
  LOGO_URL,
  SHOP_ADDRESS,
  SHOP_NAME,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_E164,
  SITE_URL,
} from "@/lib/brand";
import { RECEIPT_TTL_LABEL, receiptUrl } from "@/lib/receipt";
import { BODY, DISPLAY, EMAIL_COLORS as C, FONT_STACK, LABEL, SMALL } from "./theme";

export type EmailLine = {
  name: string;
  /** Size, for the items that come in sizes. Null for everything else. */
  size?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type OrderEmailData = {
  orderNumber: string;
  firstName: string;
  shipLines: EmailLine[];
  pickupLines: EmailLine[];
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  shipTo: {
    name: string;
    line1: string;
    line2?: string | null;
    city: string;
    region: string;
    postalCode: string;
  } | null;
  /**
   * The spots this order bought, if any. Null on a plain merchandise
   * sale — ordinary purchases earn nothing at all now.
   */
  spots: {
    game: string;
    /** The actual numbers held, which is what makes them checkable. */
    numbers: number[];
    totalSpots: number;
    unitPriceCents: number;
  } | null;
  cardBrand: string | null;
  cardLast4: string | null;
  /** Credential for the receipt link. Never rendered on its own. */
  confirmationToken: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SHOP_LINE = `${SHOP_ADDRESS.street}, ${SHOP_ADDRESS.city}, ${SHOP_ADDRESS.region} ${SHOP_ADDRESS.postalCode}`;

/**
 * The skull, sized by Cloudinary rather than by the browser.
 *
 * PNG explicitly, not `f_auto`: several mail clients still have no WebP,
 * and the one that matters here is Outlook. Served at 2x and displayed at
 * 72px so it is not soft on a phone.
 */
const LOGO_EMAIL = LOGO_URL.replace("/upload/", "/upload/f_png,q_auto,w_144/");

/** Outer content width. 600px is the widest that survives Outlook. */
const WIDTH = 600;

// ---------------------------------------------------------------- pieces

/** A full-bleed row inside the card, with consistent side padding. */
function row(content: string, style = ""): string {
  return `<tr><td style="padding:0 32px;${style}">${content}</td></tr>`;
}

/** The 11px uppercase section label. */
function sectionLabel(text: string, color: string = C.muted): string {
  return `<p style="${LABEL};margin:0;color:${color}">${escapeHtml(text)}</p>`;
}

/**
 * One purchased line: name, size, quantity, price.
 *
 * The size is not a parenthetical afterthought — for apparel it is half
 * of what was bought, and a receipt that omits it cannot be checked
 * against what turns up in the box.
 */
function lineRows(lines: EmailLine[]): string {
  return lines
    .map(
      (l) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${C.rule};${BODY};color:${C.bone}">
          <span style="font-weight:700">${escapeHtml(l.name)}</span>${
            l.size
              ? `<br><span style="${SMALL};color:${C.muted}">Size ${escapeHtml(l.size)}</span>`
              : ""
          }${
            l.quantity > 1
              ? `<span style="${SMALL};color:${C.muted}">${l.size ? " · " : "<br>"}Qty ${l.quantity}</span>`
              : ""
          }
        </td>
        <td align="right" valign="top" style="padding:12px 0;border-bottom:1px solid ${C.rule};${BODY};color:${C.bone};white-space:nowrap">
          ${formatUsd(l.lineTotalCents)}
        </td>
      </tr>`,
    )
    .join("");
}

function totalRow(label: string, value: string, emphasis = false): string {
  const size = emphasis ? "19px" : "15px";
  const weight = emphasis ? "800" : "400";
  const color = emphasis ? C.bone : C.muted;
  return `
    <tr>
      <td style="padding:5px 0;font-family:${FONT_STACK};font-size:${size};font-weight:${weight};color:${color}">${escapeHtml(label)}</td>
      <td align="right" style="padding:5px 0;font-family:${FONT_STACK};font-size:${size};font-weight:${weight};color:${emphasis ? C.bone : C.bone};white-space:nowrap">${escapeHtml(value)}</td>
    </tr>`;
}

/** A bordered panel — the notices. Left rule in the accent, as on the site. */
function panel(accent: string, textColor: string, inner: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.surface2}" style="background-color:${C.surface2};border-left:3px solid ${accent}">
    <tr><td style="padding:16px 18px;${BODY};color:${textColor}">${inner}</td></tr>
  </table>`;
}

// ----------------------------------------------------------------- render

export function renderOrderConfirmation(order: OrderEmailData): RenderedEmail {
  const subject = `Order ${order.orderNumber} — ${SHOP_NAME}`;
  const receipt = receiptUrl(order.orderNumber, order.confirmationToken);
  const collecting = order.pickupLines.length > 0;

  // The line under the subject in an inbox list. Without one, clients
  // show whatever text comes first, which here would be the logo's alt.
  const preheader = collecting
    ? `Order ${order.orderNumber}. Some of this is collected at the shop.`
    : `Order ${order.orderNumber}. Your receipt is inside.`;

  const shipBlock =
    order.shipLines.length > 0
      ? `
      ${sectionLabel("Shipping to you")}
      <p style="${SMALL};margin:10px 0 0;color:${C.muted}">${escapeHtml(SHIPPING_NOTICE)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">${lineRows(order.shipLines)}</table>
      ${
        order.shipTo
          ? `<p style="${BODY};margin:16px 0 0;color:${C.bone}">
              ${escapeHtml(order.shipTo.name)}<br>
              <span style="color:${C.muted}">${escapeHtml(order.shipTo.line1)}<br>
              ${order.shipTo.line2 ? `${escapeHtml(order.shipTo.line2)}<br>` : ""}
              ${escapeHtml(order.shipTo.city)}, ${escapeHtml(order.shipTo.region)} ${escapeHtml(order.shipTo.postalCode)}</span>
            </p>`
          : ""
      }`
      : "";

  // The one block that has to be impossible to miss: it is the difference
  // between a buyer who understands the sale is not finished and one who
  // drives across town expecting to walk out with a firearm.
  const pickupBlock = collecting
    ? `
      ${sectionLabel("Collect at the shop", C.amber)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">${lineRows(order.pickupLines)}</table>
      <div style="height:16px;line-height:16px">&nbsp;</div>
      ${panel(
        C.amber,
        C.bone,
        `<span style="color:${C.amber}">${escapeHtml(PICKUP_NOTICE)}</span>
         <div style="height:12px;line-height:12px">&nbsp;</div>
         <span style="${SMALL};color:${C.muted}">${escapeHtml(SHOP_LINE)}<br>
         <a href="tel:${SHOP_PHONE_E164}" style="color:${C.muted};text-decoration:underline">${escapeHtml(SHOP_PHONE_DISPLAY)}</a></span>`,
      )}`
    : "";

  // Deliberately flat. It says which spots are theirs and what happens
  // next, and nothing about how a winner is picked or anybody's chances
  // — the rules are the attorney's to write, and an email that describes
  // the program is an email that can contradict them.
  //
  // The numbers are the point. "You have 3 spots" is a claim; "spots 12,
  // 13 and 40 of 100" is something the buyer can check against the board.
  const spotsBlock = order.spots
    ? panel(
        C.acid,
        C.bone,
        `<strong style="color:${C.acid}">${
          order.spots.numbers.length === 1
            ? "Spot"
            : `${order.spots.numbers.length} spots`
        }</strong> in ${escapeHtml(order.spots.game)} —
         ${
           order.spots.numbers.length === 1
             ? `number <strong style="color:${C.acid}">${order.spots.numbers[0]}</strong>`
             : `numbers <strong style="color:${C.acid}">${order.spots.numbers.join(", ")}</strong>`
         } of ${order.spots.totalSpots}.
         <div style="height:10px;line-height:10px">&nbsp;</div>
         <span style="${SMALL};color:${C.muted}">The draw happens once the last
         spot sells, or earlier if the shop decides. There is no end date.
         <a href="${SITE_URL}/featured" style="color:${C.acid};text-decoration:underline">Watch the board</a>.</span>`,
      )
    : "";

  const html = `<!doctype html>
<html lang="en" style="color-scheme:dark light;supported-color-schemes:dark light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<!-- Declared so Apple Mail and iOS stop force-inverting a design that is
     already dark. Without this they "helpfully" flip the background to
     white and leave bone text on it. -->
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark light; supported-color-schemes: dark light; }
  /* Outlook.com rewrites colours under its dark theme and prefixes the
     originals onto these attributes. Restoring them here keeps the card
     dark instead of half-inverted. */
  [data-ogsc] .ml-card { background-color: ${C.surface} !important; }
  [data-ogsc] .ml-page { background-color: ${C.ink} !important; }
  [data-ogsc] .ml-bone { color: ${C.bone} !important; }
  [data-ogsc] .ml-muted { color: ${C.muted} !important; }
  [data-ogsc] .ml-acid { color: ${C.acid} !important; }
  @media only screen and (max-width:620px) {
    .ml-pad { padding-left:20px !important; padding-right:20px !important; }
    .ml-display { font-size:30px !important; }
  }
</style>
</head>
<body class="ml-page" bgcolor="${C.ink}" style="margin:0;padding:0;width:100%;background-color:${C.ink};font-family:${FONT_STACK}">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">
  ${escapeHtml(preheader)}
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ml-page" bgcolor="${C.ink}" style="background-color:${C.ink}">
<tr><td align="center" style="padding:32px 12px">

<!--[if mso]><table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ml-card" bgcolor="${C.surface}" style="max-width:${WIDTH}px;background-color:${C.surface};border:1px solid ${C.rule}">

  <!-- Logo and wordmark. The wordmark is text, so a client with images
       blocked still shows who this is from rather than a broken frame. -->
  <tr><td class="ml-pad" align="left" style="padding:32px 32px 0">
    <!-- Decorative. The wordmark directly below is the same information
         in text, so alt here would only produce a wrapped block of alt
         text in the many clients that block images by default. -->
    <img src="${LOGO_EMAIL}" width="72" height="72" alt=""
         style="display:block;border:0;outline:none;text-decoration:none;width:72px;height:auto">
    <div style="height:16px;line-height:16px">&nbsp;</div>
    <p class="ml-muted" style="${LABEL};margin:0;color:${C.muted}">${escapeHtml(SHOP_NAME)}</p>
  </td></tr>

  <tr><td class="ml-pad" style="padding:20px 32px 0">
    <h1 class="ml-bone ml-display" style="${DISPLAY};margin:0;font-size:34px;line-height:1.05;color:${C.bone};text-transform:uppercase">Thanks,<br>${escapeHtml(order.firstName)}.</h1>
    <div style="height:14px;line-height:14px">&nbsp;</div>
    <p class="ml-acid" style="${LABEL};margin:0;color:${C.acid}">Order ${escapeHtml(order.orderNumber)}</p>
  </td></tr>

  <tr><td class="ml-pad" style="padding:32px 32px 0">
    <div style="border-top:1px solid ${C.rule};height:1px;line-height:1px">&nbsp;</div>
  </td></tr>

  ${order.shipLines.length > 0 ? row(shipBlock, "padding-top:28px") : ""}
  ${collecting ? row(pickupBlock, "padding-top:28px") : ""}

  <!-- Totals -->
  <tr><td class="ml-pad" style="padding:28px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${totalRow("Subtotal", formatUsd(order.subtotalCents))}
      ${order.shippingCents > 0 ? totalRow("Shipping", formatUsd(order.shippingCents)) : ""}
      ${order.taxCents > 0 ? totalRow("Tax", formatUsd(order.taxCents)) : ""}
      <tr><td colspan="2" style="padding:10px 0 0"><div style="border-top:1px solid ${C.rule};height:1px;line-height:1px">&nbsp;</div></td></tr>
      ${totalRow("Total", formatUsd(order.totalCents), true)}
    </table>
    ${
      order.cardLast4
        ? `<p class="ml-muted" style="${SMALL};margin:10px 0 0;color:${C.muted}">Paid with ${escapeHtml(order.cardBrand ?? "card")} ending ${escapeHtml(order.cardLast4)}.</p>`
        : ""
    }
  </td></tr>

  ${order.spots ? row(spotsBlock, "padding-top:28px") : ""}

  <!-- The way back to the receipt. Without this the page exists and
       nobody can reach it once the tab is closed. A bordered block rather
       than a filled button: filled buttons are what a phishing email
       looks like, and the site has no filled buttons either. -->
  <tr><td class="ml-pad" style="padding:28px 32px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${C.surface2}" style="background-color:${C.surface2};border:1px solid ${C.acid}">
        <a href="${receipt}" style="${LABEL};display:block;padding:15px 26px;color:${C.acid};text-decoration:none">View this order</a>
      </td></tr>
    </table>
    <p class="ml-muted" style="${SMALL};margin:12px 0 0;color:${C.muted}">
      Keep this email — the link is how you get back to it, and it works
      for ${escapeHtml(RECEIPT_TTL_LABEL)}. Anyone with the link can see
      the order, so treat it like a receipt.
    </p>
  </td></tr>

  <!-- Legal. Placement 3 of 3. -->
  <tr><td class="ml-pad" style="padding:32px 32px 0">
    <div style="border-top:1px solid ${C.rule};height:1px;line-height:1px">&nbsp;</div>
    <div style="height:20px;line-height:20px">&nbsp;</div>
    <p class="ml-muted" style="${SMALL};margin:0;color:${C.muted}">${escapeHtml(FIREARM_DISCLAIMER)}</p>
    <div style="height:12px;line-height:12px">&nbsp;</div>
    <p class="ml-muted" style="${SMALL};margin:0;color:${C.muted}">${escapeHtml(REFUND_POLICY)}</p>
  </td></tr>

  <!-- Where the shop is, and how to reach a person. -->
  <tr><td class="ml-pad" style="padding:28px 32px 32px">
    <div style="border-top:1px solid ${C.rule};height:1px;line-height:1px">&nbsp;</div>
    <div style="height:20px;line-height:20px">&nbsp;</div>
    <p class="ml-bone" style="${BODY};margin:0;color:${C.bone}">
      ${escapeHtml(SHOP_ADDRESS.street)}<br>
      ${escapeHtml(SHOP_ADDRESS.city)}, ${escapeHtml(SHOP_ADDRESS.region)} ${escapeHtml(SHOP_ADDRESS.postalCode)}
    </p>
    <div style="height:10px;line-height:10px">&nbsp;</div>
    <p style="${BODY};margin:0">
      <a href="tel:${SHOP_PHONE_E164}" class="ml-acid" style="color:${C.acid};text-decoration:none;font-weight:700">${escapeHtml(SHOP_PHONE_DISPLAY)}</a>
    </p>
  </td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->

</td></tr>
</table>
</body></html>`;

  // ------------------------------------------------------- plain text
  //
  // Not a fallback nobody reads. It is what a screen reader, a watch, a
  // terminal client and every spam filter see, and a message with a thin
  // text part scores worse than one without. Laid out with rules and
  // aligned columns so it reads as a receipt rather than as a dump.

  const RULE = "-".repeat(56);
  const textLines = (lines: EmailLine[]) =>
    lines.flatMap((l) => {
      const detail = [
        l.size ? `Size ${l.size}` : null,
        l.quantity > 1 ? `Qty ${l.quantity}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const price = formatUsd(l.lineTotalCents);
      const name = l.name.length > 40 ? `${l.name.slice(0, 39)}…` : l.name;
      return [
        `  ${name.padEnd(42)}${price.padStart(10)}`,
        ...(detail ? [`  ${detail}`] : []),
      ];
    });

  const money = (label: string, value: string) =>
    `  ${label.padEnd(42)}${value.padStart(10)}`;

  const text = [
    SHOP_NAME.toUpperCase(),
    RULE,
    ``,
    `Thanks, ${order.firstName}.`,
    `Order ${order.orderNumber}`,
    ...(order.shipLines.length
      ? [
          ``,
          `SHIPPING TO YOU`,
          RULE,
          SHIPPING_NOTICE,
          ``,
          ...textLines(order.shipLines),
        ]
      : []),
    ...(order.shipTo
      ? [
          ``,
          `  ${order.shipTo.name}`,
          `  ${order.shipTo.line1}`,
          ...(order.shipTo.line2 ? [`  ${order.shipTo.line2}`] : []),
          `  ${order.shipTo.city}, ${order.shipTo.region} ${order.shipTo.postalCode}`,
        ]
      : []),
    ...(order.pickupLines.length
      ? [
          ``,
          `COLLECT AT THE SHOP`,
          RULE,
          ...textLines(order.pickupLines),
          ``,
          PICKUP_NOTICE,
          ``,
          `  ${SHOP_LINE}`,
          `  ${SHOP_PHONE_DISPLAY}`,
        ]
      : []),
    ``,
    RULE,
    money("Subtotal", formatUsd(order.subtotalCents)),
    ...(order.shippingCents > 0
      ? [money("Shipping", formatUsd(order.shippingCents))]
      : []),
    ...(order.taxCents > 0 ? [money("Tax", formatUsd(order.taxCents))] : []),
    money("TOTAL", formatUsd(order.totalCents)),
    RULE,
    ...(order.cardLast4
      ? [`  Paid with ${order.cardBrand ?? "card"} ending ${order.cardLast4}.`]
      : []),
    ...(order.spots
      ? [
          ``,
          `YOUR SPOTS`,
          RULE,
          `${order.spots.numbers.length === 1 ? "Spot" : "Spots"} ${order.spots.numbers.join(", ")} of ${order.spots.totalSpots}`,
          `in ${order.spots.game}.`,
          ``,
          `The draw happens once the last spot sells, or earlier if the`,
          `shop decides. There is no end date.`,
          `${SITE_URL}/featured`,
        ]
      : []),
    ``,
    `VIEW THIS ORDER`,
    RULE,
    receipt,
    ``,
    `Keep this email — the link is how you get back to it, and it works`,
    `for ${RECEIPT_TTL_LABEL}. Anyone with the link can see the order, so`,
    `treat it like a receipt.`,
    ``,
    RULE,
    FIREARM_DISCLAIMER,
    ``,
    REFUND_POLICY,
    ``,
    RULE,
    SHOP_NAME,
    SHOP_ADDRESS.street,
    `${SHOP_ADDRESS.city}, ${SHOP_ADDRESS.region} ${SHOP_ADDRESS.postalCode}`,
    SHOP_PHONE_DISPLAY,
  ].join("\n");

  return { subject, html, text };
}
