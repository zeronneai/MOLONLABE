// Owner notification: POST the payload to a Google Apps Script web app
// that appends a sheet row and emails the owner (same pattern as our
// other builds — PROJECT_BRIEF.md section 10). Never lets a notification
// failure break a form submit.
//
// Every payload carries two things:
//
//   * the structured fields, which the sheet columns are built from, and
//   * `summary`, a pre-rendered plain-text block the script can print as
//     the body of the owner's email without formatting anything.
//
// The summary exists because the alternative is the script reassembling
// prose out of JSON, which puts a second opinion about wording — and
// about which fields matter — somewhere nothing here can test. This file
// knows what an order looks like; the script should not have to.

import { formatUsd } from "@/lib/money";

// ---------------------------------------------------------------- types
//
// A union rather than Record<string, unknown>. The shapes had already
// drifted once, and the documented payload in docs/email.md is only as
// true as the thing that produces it.

export type NotifyLine = {
  name: string;
  size?: string | null;
  quantity: number;
  line_total_cents: number;
};

export type OwnerNotification =
  | {
      kind: "inquiry";
      type: "item" | "transfer" | "general" | "service";
      item_id: string | null;
      item_slug: string | null;
      name: string;
      email: string;
      phone: string | null;
      message: string | null;
    }
  | {
      kind: "entry";
      name: string;
      email: string;
      phone: string | null;
      campaign: string;
      method: "free";
    }
  | {
      kind: "order";
      order_number: string;
      name: string;
      email: string;
      phone: string | null;
      subtotal_cents: number;
      tax_cents: number;
      shipping_cents: number;
      total_cents: number;
      card_brand: string | null;
      card_last4: string | null;
      /** Names only, kept for the existing sheet columns. */
      ships: string[];
      collects: string[];
      /** The same lines with their detail, for the summary. */
      ship_lines: NotifyLine[];
      pickup_lines: NotifyLine[];
      entries_awarded: number;
      campaign: string | null;
      confirmation_emailed: boolean;
    }
  | {
      kind: "order_error";
      severity: "urgent";
      /** Which of the three failures. `charged_not_saved` is the bad one. */
      failure: "charged_not_saved" | "lines_not_saved" | "entries_not_awarded";
      message: string;
      order_number: string;
      transaction_id?: string;
      total_cents?: number;
      email?: string;
      entries_awarded?: number;
    };

// ------------------------------------------------------------ summaries

const RULE = "-".repeat(46);

/** Best effort, and it passes anything it does not recognise through. */
function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

/** name · email · phone, skipping what is absent. */
function who(n: { name: string; email: string; phone: string | null }): string {
  return [n.name, n.email, formatPhone(n.phone)].filter(Boolean).join(" · ");
}

function lineBlock(lines: NotifyLine[]): string[] {
  return lines.map((l) => {
    const name = [l.name, l.size].filter(Boolean).join(", ");
    const qty = l.quantity > 1 ? ` ×${l.quantity}` : "";
    return `  ${name}${qty} — ${formatUsd(l.line_total_cents)}`;
  });
}

/**
 * The owner's email, already written.
 *
 * Exported so it can be tested directly rather than only through a
 * browser and a network hop.
 */
export function summarize(n: OwnerNotification): string {
  switch (n.kind) {
    case "order": {
      const money = [
        `Subtotal ${formatUsd(n.subtotal_cents)}`,
        n.tax_cents > 0 ? `Tax ${formatUsd(n.tax_cents)}` : null,
        n.shipping_cents > 0 ? `Shipping ${formatUsd(n.shipping_cents)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const paid = [
        `Total ${formatUsd(n.total_cents)}`,
        n.card_last4 ? `${n.card_brand ?? "Card"} ending ${n.card_last4}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return [
        `NEW ORDER — ${n.order_number}`,
        who(n),
        ...(n.pickup_lines.length
          ? ["", "COLLECT AT SHOP", ...lineBlock(n.pickup_lines)]
          : []),
        ...(n.ship_lines.length ? ["", "SHIPS", ...lineBlock(n.ship_lines)] : []),
        "",
        money,
        paid,
        ...(n.entries_awarded > 0
          ? [
              "",
              `Earned ${n.entries_awarded} ${n.entries_awarded === 1 ? "entry" : "entries"}${n.campaign ? ` in ${n.campaign}` : ""}.`,
            ]
          : []),
        // The two things that decide what the shop does next.
        ...(n.pickup_lines.length ? ["", "Background check due at pickup."] : []),
        ...(n.confirmation_emailed
          ? []
          : ["", "The customer did NOT get a confirmation email. Send one by hand."]),
      ].join("\n");
    }

    case "inquiry": {
      const heading = {
        item: "ITEM ENQUIRY",
        transfer: "FFL TRANSFER REQUEST",
        general: "GENERAL MESSAGE",
        service: "SERVICE REQUEST",
      }[n.type];
      return [
        heading,
        who(n),
        ...(n.item_slug ? ["", `About: ${n.item_slug}`] : []),
        ...(n.message ? ["", n.message] : []),
      ].join("\n");
    }

    case "entry":
      return [
        `FREE ENTRY — ${n.campaign}`,
        who(n),
        "",
        "No purchase. One entry.",
      ].join("\n");

    case "order_error": {
      // This one is read at a glance or not at all, so it does not open
      // with a noun phrase. The first case means money moved and nothing
      // recorded it; the banner says so before anything else.
      const banner =
        n.failure === "charged_not_saved"
          ? [
              "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
              "!!  A CARD WAS CHARGED AND THE ORDER WAS   !!",
              "!!  NOT SAVED. NOTHING RECORDED THIS SALE. !!",
              "!!  ACT NOW.                               !!",
              "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
            ]
          : ["!! URGENT — SOMETHING DID NOT RECORD !!"];

      const detail =
        n.failure === "charged_not_saved"
          ? [
              `Order number  ${n.order_number}`,
              `Charged       ${n.total_cents != null ? formatUsd(n.total_cents) : "unknown"}`,
              `Transaction   ${n.transaction_id ?? "unknown"}`,
              `Customer      ${n.email ?? "unknown"}`,
              "",
              "The customer has been told not to pay again and to call",
              "with this order number. The money is at the gateway and",
              "the order is not in the database. Find the transaction in",
              "Authorize.net and write the order up by hand.",
            ]
          : n.failure === "lines_not_saved"
            ? [
                `Order number  ${n.order_number}`,
                "",
                "The order exists with its totals but none of its line",
                "items were written, so nothing says what was bought.",
                "The customer's confirmation email has the list.",
              ]
            : [
                `Order number  ${n.order_number}`,
                `Customer      ${n.email ?? "unknown"}`,
                `Entries owed  ${n.entries_awarded ?? "unknown"}`,
                "",
                "The purchase earned entries that were not credited.",
                "Fixable by hand, and it has to happen before the draw.",
              ];

      return [...banner, "", RULE, n.message, RULE, "", ...detail].join("\n");
    }
  }
}

// -------------------------------------------------------------- transport

export async function notifyOwner(payload: OwnerNotification): Promise<void> {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        summary: summarize(payload),
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("notifyOwner failed:", err);
  }
}
