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
import { AGENCY_CONTACT, AGENCY_NAME } from "@/lib/brand";

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
      /**
       * What the checkout is still holding off the shelf.
       *
       * Stock is claimed before the card is charged and is deliberately
       * NOT released on this path — the customer paid, so the goods stay
       * theirs until a person decides otherwise. The consequence is that
       * a refund without putting the stock back leaves an item invisible
       * on the site forever, which is why the recovery steps name it.
       */
      held?: HeldItem[];
    };

export type HeldItem = {
  name: string;
  size: string | null;
  quantity: number;
  /** A single-unit row sits at "reserved"; a size has had stock taken. */
  hold: "reserved" | "stock";
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

    case "order_error":
      return orderErrorSummary(n);
  }
}

/**
 * The one message where a slow read costs the shop money.
 *
 * Written to survive a proportional font, because that is what most mail
 * clients use for text/plain and an ASCII box collapses into nonsense in
 * one. No aligned columns, no box art — capitals, blank lines and short
 * lines do the work instead, and they do it in any font.
 *
 * It is long, deliberately. It arrives rarely and it is a runbook, not a
 * notification: somebody is reading it having never seen one before,
 * probably from a phone, probably with a customer on hold.
 */
function orderErrorSummary(
  n: Extract<OwnerNotification, { kind: "order_error" }>,
): string {
  const facts = [
    `Order number: ${n.order_number}`,
    n.total_cents != null ? `Amount charged: ${formatUsd(n.total_cents)}` : null,
    n.transaction_id ? `Authorize.net transaction ID: ${n.transaction_id}` : null,
    n.email ? `Customer: ${n.email}` : null,
  ].filter(Boolean) as string[];

  if (n.failure === "charged_not_saved") {
    const heldLines = (n.held ?? []).map((h) => {
      const name = [h.name, h.size].filter(Boolean).join(", ");
      const qty = h.quantity > 1 ? ` ×${h.quantity}` : "";
      return h.hold === "reserved"
        ? `  ${name}${qty} — marked RESERVED, off the website`
        : `  ${name}${qty} — taken out of that size's stock`;
    });

    return [
      "URGENT. READ THIS NOW.",
      "",
      "A CARD WAS CHARGED AND THE ORDER WAS NOT SAVED.",
      "The money moved. Nothing in the system recorded the sale.",
      "",
      ...facts,
      "",
      "WHAT HAPPENED",
      "",
      "Authorize.net approved the card and took the money. Writing the",
      "order to the database failed straight afterwards, so the shop has",
      "no record of what was bought. The customer has been shown the",
      "order number above and told not to pay again and to call you.",
      ...(heldLines.length
        ? [
            "",
            "WHAT IS BEING HELD",
            "",
            "The stock was already taken off the shelf before the card was",
            "charged, and it has NOT been put back:",
            "",
            ...heldLines,
            "",
            "That is deliberate — they paid for it. But it means step 4",
            "below is not optional.",
          ]
        : []),
      "",
      "WHAT TO DO, IN THIS ORDER",
      "",
      "1. CHECK THE ADMIN FIRST.",
      "",
      `   Open Orders and search for ${n.order_number}. If it is there,`,
      "   the write recovered by itself and there is nothing to fix.",
      "   Stop here. If it is not there, keep going.",
      "",
      "2. FIND THE MONEY IN AUTHORIZE.NET.",
      "",
      "   Sign in to the Merchant Interface and search the transactions",
      "   for the transaction ID above. If you cannot find it by ID,",
      "   search by today's date and the amount. What you do next",
      "   depends on its status:",
      "",
      "   UNSETTLED / PENDING SETTLEMENT — the daily batch has not",
      "   closed yet. You can VOID it. A void is clean: in most cases",
      "   the customer never sees the charge on their statement at all.",
      "",
      "   SETTLED SUCCESSFULLY — the batch has closed and voiding is no",
      "   longer possible. A REFUND is the only way back, it needs the",
      "   last four digits of the card, and it takes a few days to show",
      "   on their statement.",
      "",
      "   Do not void or refund yet. Do step 3 first.",
      "",
      "3. CALL THE CUSTOMER BEFORE YOU DECIDE.",
      "",
      "   They paid and they are waiting. Two ways this goes:",
      "",
      "   THEY STILL WANT IT, and you still have it — keep the money,",
      "   write the order up by hand the way you would a counter sale,",
      "   and treat it as a normal sale from there. A firearm still",
      "   needs its background check at pickup like any other.",
      "",
      "   THEY DO NOT WANT IT, or it is already gone — void it if the",
      "   batch has not closed, refund it if it has. Tell them which,",
      "   and roughly when the money comes back.",
      "",
      "4. PUT THE STOCK BACK IF YOU REFUNDED.",
      "",
      "   Only if you voided or refunded. The item is still held and",
      "   will stay invisible on the website until somebody changes it",
      "   by hand:",
      "",
      "   - A single item is sitting at RESERVED. Set it back to",
      "     AVAILABLE in the admin.",
      "   - A size had its stock reduced. Add the quantity back to that",
      "     size on the item.",
      "",
      "   Skip this and the shop quietly stops being able to sell it.",
      "",
      "5. WRITE DOWN WHAT YOU DID.",
      "",
      "   The order number, the transaction ID, and whether you kept,",
      "   voided or refunded it. Nothing else recorded this sale, so",
      "   what you write down is the only record it happened.",
      "",
      "WHO TO CALL",
      "",
      ...(n.email ? [`Customer: ${n.email}`] : []),
      "Authorize.net merchant support: the number is on your merchant",
      "  statement and on the Support page inside the Merchant Interface.",
      `${AGENCY_NAME}: ${AGENCY_CONTACT} — tell us it happened even if`,
      "  you already fixed it, so we can find out why.",
    ].join("\n");
  }

  if (n.failure === "lines_not_saved") {
    return [
      "URGENT — AN ORDER SAVED WITHOUT ITS ITEMS.",
      "",
      "The order and its totals were written. The list of what was",
      "actually bought was not, so the order looks empty in the admin.",
      "",
      ...facts,
      "",
      "WHAT TO DO",
      "",
      "1. The customer's confirmation email has the full list. Ask them",
      "   to forward it, or find the order in Authorize.net for the",
      "   amount and work back from that.",
      "2. Write the items onto the order by hand so the shop knows what",
      "   to hand over or post.",
      "3. The money is fine. Nothing needs voiding or refunding.",
      "",
      `${AGENCY_NAME}: ${AGENCY_CONTACT}`,
    ].join("\n");
  }

  return [
    "URGENT — A PURCHASE DID NOT GET ITS SWEEPSTAKES ENTRIES.",
    "",
    "The sale is fine and the money is fine. The entries the purchase",
    "earned were not credited to the customer.",
    "",
    ...facts,
    ...(n.entries_awarded != null
      ? [`Entries owed: ${n.entries_awarded}`]
      : []),
    "",
    "WHAT TO DO",
    "",
    "1. Add the entries by hand in the admin, under Entrants, against",
    "   the email above.",
    "2. It has to happen before the drawing. After the draw it cannot",
    "   be put right.",
    "",
    `${AGENCY_NAME}: ${AGENCY_CONTACT}`,
  ].join("\n");
}

/**
 * The inbox line.
 *
 * Supplied rather than left to the script, because this is the whole of
 * what the owner sees before deciding whether to open something. The
 * urgent one leads with the words that matter and does not bury them
 * behind a prefix.
 */
export function subjectFor(n: OwnerNotification): string {
  switch (n.kind) {
    case "order":
      return `New order ${n.order_number} — ${formatUsd(n.total_cents)}${
        n.collects.length ? " — COLLECT AT SHOP" : ""
      }`;
    case "inquiry":
      return {
        item: `Item enquiry — ${n.name}`,
        transfer: `FFL transfer request — ${n.name}`,
        general: `Message from the website — ${n.name}`,
        service: `Service request — ${n.name}`,
      }[n.type];
    case "entry":
      return `Free entry — ${n.name}`;
    case "order_error":
      return n.failure === "charged_not_saved"
        ? `URGENT: card charged, order NOT saved — ${n.order_number}`
        : n.failure === "lines_not_saved"
          ? `URGENT: order ${n.order_number} saved without its items`
          : `URGENT: order ${n.order_number} did not get its entries`;
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
        subject: subjectFor(payload),
        summary: summarize(payload),
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("notifyOwner failed:", err);
  }
}
