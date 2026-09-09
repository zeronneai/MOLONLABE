// The buyer's confirmation, rendered as a pure function of the order.
//
// Pure on purpose: no database, no network, no clock. That makes the one
// piece of this flow with real legal content directly testable, and it
// means the same renderer can produce a preview in the admin without
// sending anything to anybody.
//
// Inline styles and a table layout because email clients are not
// browsers: no <style> block survives Gmail reliably, and flexbox does
// not exist in Outlook.

import { formatUsd } from "@/lib/money";
import {
  FIREARM_DISCLAIMER,
  PICKUP_NOTICE,
  REFUND_POLICY,
  SHIPPING_NOTICE,
  ENTRY_CLAIM,
} from "@/lib/legal";
import { SHOP_ADDRESS, SHOP_NAME, SHOP_PHONE_DISPLAY, SITE_URL } from "@/lib/brand";
import { RECEIPT_TTL_LABEL, receiptUrl } from "@/lib/receipt";

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
  entriesAwarded: number;
  /**
   * The buyer's running total in this campaign after this order, straight
   * from `add_purchase_entries`, which returns it. Null when there is no
   * campaign, when this order earned nothing, or when the entry write
   * failed — in which case the email says nothing about a total rather
   * than stating a number nobody has verified.
   */
  entriesTotal: number | null;
  campaignTitle: string | null;
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

function lineRows(lines: EmailLine[]): string {
  return lines
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e2da;font-size:15px;color:#16151a">
          ${escapeHtml(l.name)}${
            l.size ? ` <span style="color:#6b6c70">— ${escapeHtml(l.size)}</span>` : ""
          }${l.quantity > 1 ? ` <span style="color:#6b6c70">× ${l.quantity}</span>` : ""}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e2da;font-size:15px;color:#16151a;text-align:right;white-space:nowrap">
          ${formatUsd(l.lineTotalCents)}
        </td>
      </tr>`,
    )
    .join("");
}

function totalRow(label: string, value: string, bold = false): string {
  const weight = bold ? "700" : "400";
  const size = bold ? "17px" : "15px";
  return `
    <tr>
      <td style="padding:6px 0;font-size:${size};font-weight:${weight};color:#16151a">${label}</td>
      <td style="padding:6px 0;font-size:${size};font-weight:${weight};color:#16151a;text-align:right;white-space:nowrap">${value}</td>
    </tr>`;
}

export function renderOrderConfirmation(order: OrderEmailData): RenderedEmail {
  const subject = `Order ${order.orderNumber} — ${SHOP_NAME}`;

  const shipBlock =
    order.shipLines.length > 0
      ? `
      <h2 style="margin:32px 0 4px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#6b6c70">Shipping to you</h2>
      <p style="margin:0 0 12px;font-size:14px;color:#6b6c70">${escapeHtml(SHIPPING_NOTICE)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${lineRows(order.shipLines)}</table>
      ${
        order.shipTo
          ? `<p style="margin:14px 0 0;font-size:15px;color:#16151a;line-height:1.5">
              ${escapeHtml(order.shipTo.name)}<br>
              ${escapeHtml(order.shipTo.line1)}<br>
              ${order.shipTo.line2 ? `${escapeHtml(order.shipTo.line2)}<br>` : ""}
              ${escapeHtml(order.shipTo.city)}, ${escapeHtml(order.shipTo.region)} ${escapeHtml(order.shipTo.postalCode)}
            </p>`
          : ""
      }`
      : "";

  // The pickup block is the one that has to be impossible to miss: it is
  // the difference between a buyer who understands the sale is not
  // finished and one who drives across town expecting to collect.
  const pickupBlock =
    order.pickupLines.length > 0
      ? `
      <h2 style="margin:32px 0 4px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#6b6c70">Collect at the shop</h2>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${lineRows(order.pickupLines)}</table>
      <div style="margin:14px 0 0;padding:16px;background:#fdf6e7;border-left:3px solid #c08a2e">
        <p style="margin:0;font-size:15px;line-height:1.55;color:#4a3a14"><strong>${escapeHtml(PICKUP_NOTICE)}</strong></p>
        <p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#4a3a14">
          ${escapeHtml(SHOP_LINE)}<br>${escapeHtml(SHOP_PHONE_DISPLAY)}
        </p>
      </div>`
      : "";

  // Deliberately flat. It states two counts and where the free method is,
  // and says nothing about how entries are drawn, what they are worth or
  // what anybody's chances are — the rules are the attorney's to write,
  // and an email that describes the program is an email that can
  // contradict them.
  // The campaign is named by the sentence before this one, so this one
  // does not name it again.
  const totalSentence =
    order.entriesTotal !== null
      ? ` You now have <strong>${order.entriesTotal} ${
          order.entriesTotal === 1 ? "entry" : "entries"
        }</strong> in total.`
      : "";

  const entriesBlock =
    order.entriesAwarded > 0
      ? `
      <div style="margin:28px 0 0;padding:16px;background:#f2f7f0;border-left:3px solid #57b94a">
        <p style="margin:0;font-size:15px;line-height:1.55;color:#1f3a1a">
          This order earned <strong>${order.entriesAwarded} ${order.entriesAwarded === 1 ? "entry" : "entries"}</strong>${
            order.campaignTitle ? ` in ${escapeHtml(order.campaignTitle)}` : ""
          }.${totalSentence} ${ENTRY_CLAIM.link} — the free method is at
          <a href="${SITE_URL}/featured" style="color:#2e5f28">${SITE_URL}/featured</a>.
        </p>
      </div>`
      : "";

  // The way back to the receipt. Without this the page exists and nobody
  // can reach it once the tab is closed.
  const receipt = receiptUrl(order.orderNumber, order.confirmationToken);
  const receiptBlock = `
      <div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e5e2da">
        <p style="margin:0;font-size:15px;line-height:1.55;color:#16151a">
          <a href="${receipt}" style="color:#2e5f28"><strong>View this order</strong></a>
        </p>
        <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:#6b6c70">
          Keep this email — the link is how you get back to it, and it
          works for ${RECEIPT_TTL_LABEL}. Anyone with the link can see the
          order, so treat it like a receipt.
        </p>
      </div>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f6f4ef;padding:28px 12px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;padding:32px;border:1px solid #e5e2da;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <tr><td>
    <p style="margin:0;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#6b6c70">${escapeHtml(SHOP_NAME)}</p>
    <h1 style="margin:14px 0 0;font-size:26px;line-height:1.15;color:#16151a">Thanks, ${escapeHtml(order.firstName)}.</h1>
    <p style="margin:10px 0 0;font-size:15px;color:#6b6c70">Order ${escapeHtml(order.orderNumber)}</p>

    ${shipBlock}
    ${pickupBlock}

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;border-top:1px solid #e5e2da;padding-top:8px">
      ${totalRow("Subtotal", formatUsd(order.subtotalCents))}
      ${order.shippingCents > 0 ? totalRow("Shipping", formatUsd(order.shippingCents)) : ""}
      ${order.taxCents > 0 ? totalRow("Tax", formatUsd(order.taxCents)) : ""}
      ${totalRow("Total", formatUsd(order.totalCents), true)}
    </table>
    ${
      order.cardLast4
        ? `<p style="margin:10px 0 0;font-size:14px;color:#6b6c70">Paid with ${escapeHtml(order.cardBrand ?? "card")} ending ${escapeHtml(order.cardLast4)}.</p>`
        : ""
    }

    ${entriesBlock}
    ${receiptBlock}

    <div style="margin:32px 0 0;padding-top:20px;border-top:1px solid #e5e2da">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6c70">${escapeHtml(FIREARM_DISCLAIMER)}</p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#6b6c70">${escapeHtml(REFUND_POLICY)}</p>
    </div>

    <p style="margin:24px 0 0;font-size:14px;color:#6b6c70">
      Questions? Call ${escapeHtml(SHOP_PHONE_DISPLAY)}.<br>${escapeHtml(SHOP_LINE)}
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const textLines = (lines: EmailLine[]) =>
    lines
      .map(
        (l) =>
          `  ${l.name}${l.size ? ` (${l.size})` : ""}${l.quantity > 1 ? ` x${l.quantity}` : ""}  ${formatUsd(l.lineTotalCents)}`,
      )
      .join("\n");

  const text = [
    `${SHOP_NAME}`,
    ``,
    `Thanks, ${order.firstName}.`,
    `Order ${order.orderNumber}`,
    ...(order.shipLines.length
      ? [``, `SHIPPING TO YOU`, SHIPPING_NOTICE, textLines(order.shipLines)]
      : []),
    ...(order.shipTo
      ? [
          ``,
          `${order.shipTo.name}`,
          `${order.shipTo.line1}`,
          ...(order.shipTo.line2 ? [order.shipTo.line2] : []),
          `${order.shipTo.city}, ${order.shipTo.region} ${order.shipTo.postalCode}`,
        ]
      : []),
    ...(order.pickupLines.length
      ? [
          ``,
          `COLLECT AT THE SHOP`,
          textLines(order.pickupLines),
          ``,
          PICKUP_NOTICE,
          SHOP_LINE,
          SHOP_PHONE_DISPLAY,
        ]
      : []),
    ``,
    `Subtotal  ${formatUsd(order.subtotalCents)}`,
    ...(order.shippingCents > 0 ? [`Shipping  ${formatUsd(order.shippingCents)}`] : []),
    ...(order.taxCents > 0 ? [`Tax       ${formatUsd(order.taxCents)}`] : []),
    `Total     ${formatUsd(order.totalCents)}`,
    ...(order.cardLast4
      ? [``, `Paid with ${order.cardBrand ?? "card"} ending ${order.cardLast4}.`]
      : []),
    ...(order.entriesAwarded > 0
      ? [
          ``,
          `This order earned ${order.entriesAwarded} ${order.entriesAwarded === 1 ? "entry" : "entries"}${order.campaignTitle ? ` in ${order.campaignTitle}` : ""}.`,
          ...(order.entriesTotal !== null
            ? [
                `You now have ${order.entriesTotal} ${order.entriesTotal === 1 ? "entry" : "entries"} in total.`,
              ]
            : []),
          `${ENTRY_CLAIM.link}: ${SITE_URL}/featured`,
        ]
      : []),
    ``,
    `View this order: ${receipt}`,
    `Keep this email — the link is how you get back to it, and it works for ${RECEIPT_TTL_LABEL}.`,
    ``,
    FIREARM_DISCLAIMER,
    ``,
    REFUND_POLICY,
    ``,
    `Questions? Call ${SHOP_PHONE_DISPLAY}.`,
    SHOP_LINE,
  ].join("\n");

  return { subject, html, text };
}
