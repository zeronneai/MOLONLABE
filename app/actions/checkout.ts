"use server";

// Checkout. The only place money moves.
//
// Order of operations matters more here than anywhere else in the app:
//
//   1. Price the cart from the database. The browser's numbers are never
//      trusted, or read at all.
//   2. Claim the stock. Inventory rows are individual units, so the claim
//      is a conditional update that only succeeds if the item is still
//      available. This closes the window where two people check out the
//      same pistol.
//   3. Charge. Only now, with the goods held.
//   4. Record. Order, lines, entries, item finalisation.
//
// If the charge fails, the claim is released. If the charge succeeds but
// recording fails, the claim is NOT released and the failure is shouted
// about, because at that point the buyer has been charged and a human has
// to look at it — quietly returning the item to sale would be the worst
// possible outcome.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/service";
import { priceCart } from "@/lib/cart/pricing";
import { getPaymentProvider } from "@/lib/payments";
import { renderOrderConfirmation } from "@/lib/email/orderConfirmation";
import { sendEmail } from "@/lib/email/send";
import { notifyOwner } from "@/lib/notify";
import { logDbError } from "@/lib/db/log";
import {
  DISCLAIMER_VERSION,
  FIREARM_DISCLAIMER,
  REFUND_POLICY,
} from "@/lib/legal";
import { SHOP_NAME } from "@/lib/brand";
import type { CartLine } from "@/lib/cart/types";

const addressSchema = z.object({
  line1: z.string().trim().min(1, "Street address, please.").max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City, please.").max(80),
  region: z.string().trim().min(2, "State, please.").max(40),
  postalCode: z.string().trim().min(5, "ZIP, please.").max(12),
});

const checkoutSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1),
        variantId: z.string().min(1).nullable().optional(),
      }),
    )
    .min(1, "Your cart is empty.")
    .max(50),
  customer: z.object({
    firstName: z.string().trim().min(1, "First name, please.").max(80),
    lastName: z.string().trim().min(1, "Last name, please.").max(80),
    email: z.string().trim().email("That email doesn't look right.").max(200),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
  }),
  shipping: addressSchema.nullable(),
  disclaimerAccepted: z.literal(true, {
    message: "You have to accept the terms before we can take payment.",
  }),
  opaqueData: z.object({
    dataDescriptor: z.string().min(1).max(200),
    dataValue: z.string().min(1).max(8000),
  }),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

export type CheckoutResult =
  | { ok: true; orderNumber: string; token: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Human-quotable on the phone, and short enough for the gateway's 20. */
function orderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0, no I/1
  let suffix = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `MLF-${suffix}`;
}

function confirmationToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

export async function submitCheckout(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  const sb = getServiceSupabase();
  if (!sb) {
    return {
      ok: false,
      message:
        "We can't take orders right now. Call the shop and we'll sort it out by phone.",
    };
  }

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return {
      ok: false,
      message:
        "Card payments aren't switched on yet. Call the shop and we'll take it over the phone.",
    };
  }

  // 1. Price from the database. Note that `data.lines` contributes only
  //    ids and quantities; every amount below comes from `cart`.
  const cart = await priceCart(data.lines as CartLine[], sb);
  if (cart.lines.length === 0) {
    return {
      ok: false,
      message:
        cart.rejected.length > 0
          ? "Everything in your cart has sold or changed. Start again from the inventory."
          : "Your cart is empty.",
    };
  }
  if (cart.rejected.length > 0) {
    return {
      ok: false,
      message:
        "Something in your cart changed while you were checking out. Go back to the cart and take another look before paying.",
    };
  }
  if (cart.hasShipment && !data.shipping) {
    return {
      ok: false,
      message: "We need a shipping address for the items that ship.",
      fieldErrors: { "shipping.line1": "Shipping address, please." },
    };
  }
  if (cart.totalCents <= 0) {
    return { ok: false, message: "That order totals nothing. Check your cart." };
  }

  // 2. Claim the stock before charging, so a simultaneous checkout of the
  //    last one loses here rather than at the counter.
  //
  //    Two kinds of claim, because there are two kinds of stock. A rifle
  //    is one row that flips available -> reserved. A shirt in medium is a
  //    count that goes down by one, and the item itself stays on sale
  //    because the larges are still there.
  const claims: Claim[] = [];
  for (const line of cart.lines) {
    let held = false;
    if (line.variantId) {
      const { data, error } = await sb.rpc("claim_variant_stock", {
        p_variant: line.variantId,
        p_qty: line.quantity,
      });
      if (error) logDbError("checkout claim variant", error);
      held = data === true;
      if (held) claims.push({ kind: "variant", variantId: line.variantId, quantity: line.quantity });
    } else {
      const { data: rows, error } = await sb
        .from("items")
        .update({ status: "reserved" })
        .eq("id", line.itemId)
        .eq("status", "available")
        .select("id");
      if (error) logDbError("checkout claim", error);
      held = Boolean(rows && rows.length > 0);
      if (held) claims.push({ kind: "unit", itemId: line.itemId });
    }

    if (!held) {
      await releaseClaims(sb, claims);
      return {
        ok: false,
        message: line.size
          ? `${line.name} in ${line.size} sold out while you were checking out. Nothing has been charged.`
          : `${line.name} was taken while you were checking out. Nothing has been charged.`,
      };
    }
  }

  // 3. Charge.
  const number = orderNumber();
  const charge = await provider.charge({
    amountCents: cart.totalCents,
    opaqueData: data.opaqueData,
    invoiceNumber: number,
    description: `${SHOP_NAME} order ${number}`,
    customer: {
      email: data.customer.email,
      firstName: data.customer.firstName,
      lastName: data.customer.lastName,
      phone: data.customer.phone || null,
    },
    billTo: data.shipping
      ? {
          address: data.shipping.line1,
          city: data.shipping.city,
          state: data.shipping.region,
          zip: data.shipping.postalCode,
        }
      : undefined,
    ipAddress: await clientIp(),
  });

  if (!charge.ok) {
    await releaseClaims(sb, claims);
    console.error("checkout charge failed:", charge.detail);
    return { ok: false, message: charge.message };
  }

  // 4. Record. Past this line the buyer's card has been charged, so every
  //    failure is logged loudly and none of them release the stock.
  const token = confirmationToken();
  const acceptedAt = new Date().toISOString();

  const { data: order, error: orderError } = await sb
    .from("orders")
    .insert({
      order_number: number,
      status: "paid",
      email: data.customer.email,
      first_name: data.customer.firstName,
      last_name: data.customer.lastName,
      phone: data.customer.phone || null,
      subtotal_cents: cart.subtotalCents,
      tax_cents: cart.taxCents,
      shipping_cents: cart.shippingCents,
      total_cents: cart.totalCents,
      has_shipment: cart.hasShipment,
      has_pickup: cart.hasPickup,
      ship_name: data.shipping
        ? `${data.customer.firstName} ${data.customer.lastName}`
        : null,
      ship_line1: data.shipping?.line1 ?? null,
      ship_line2: data.shipping?.line2 || null,
      ship_city: data.shipping?.city ?? null,
      ship_region: data.shipping?.region ?? null,
      ship_postal_code: data.shipping?.postalCode ?? null,
      // The acceptance and the exact wording accepted, together. Either
      // one alone is close to worthless as a record.
      disclaimer_accepted_at: acceptedAt,
      // Stored clean. The version goes in its own column — appending it
      // to the text put an internal identifier in front of the buyer on
      // the confirmation page, which is where this is read back.
      disclaimer_text: FIREARM_DISCLAIMER,
      disclaimer_version: DISCLAIMER_VERSION,
      refund_policy_text: REFUND_POLICY,
      campaign_id: cart.campaign?.id ?? null,
      entries_per_dollar: cart.entriesPerDollar,
      entries_awarded: cart.entriesEarned,
      gateway: provider.name,
      gateway_transaction_id: charge.transactionId,
      gateway_auth_code: charge.authCode,
      gateway_response_code: charge.responseCode,
      card_brand: charge.cardBrand,
      card_last4: charge.cardLast4,
      confirmation_token: token,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    // Charged and not recorded. This needs a person, now.
    console.error(
      `CHARGED BUT NOT RECORDED — transaction ${charge.transactionId}, order ${number}, ${cart.totalCents} cents:`,
      orderError?.message,
    );
    await notifyOwner({
      kind: "order_error",
      severity: "urgent",
      message: "A card was charged but the order could not be saved.",
      transaction_id: charge.transactionId,
      order_number: number,
      total_cents: cart.totalCents,
      email: data.customer.email,
    });
    return {
      ok: false,
      message:
        "Your payment went through but we hit a problem saving the order. Don't pay again — call the shop with this number and we'll finish it by hand: " +
        number,
    };
  }

  const { error: linesError } = await sb.from("order_items").insert(
    cart.lines.map((line) => ({
      order_id: order.id,
      line_type: "inventory",
      item_id: line.itemId,
      variant_id: line.variantId,
      // Snapshotted as text as well as by id: the shop may stop carrying
      // that size and delete the row, and the receipt still has to say
      // which one was bought.
      size: line.size,
      name: line.name,
      unit_price_cents: line.unitPriceCents,
      quantity: line.quantity,
      fulfillment_type: line.fulfillment,
      line_total_cents: line.lineTotalCents,
    })),
  );
  if (linesError) {
    logDbError("checkout order_items", linesError);
    await notifyOwner({
      kind: "order_error",
      severity: "urgent",
      message: "Order saved but its line items did not.",
      order_number: number,
    });
  }

  // Shipped goods are done; collected goods stay reserved until the
  // background check clears at the counter, because a check that fails
  // puts the firearm back on the shelf.
  // Only single-unit lines. A shirt whose medium just sold is still on
  // sale in large, so its stock went down and its status must not move.
  const shipIds = cart.shipLines.filter((l) => !l.variantId).map((l) => l.itemId);
  if (shipIds.length > 0) {
    const { error } = await sb
      .from("items")
      .update({ status: "sold" })
      .in("id", shipIds);
    if (error) logDbError("checkout mark sold", error);
  }

  // Entries. A failure here must not fail the order — the buyer has their
  // goods either way — but the owner needs to know so it can be fixed by
  // hand before the draw.
  // The function returns the buyer's running total for the campaign after
  // the increment, atomically. That is the number the email quotes — no
  // second read, and no window in which another order lands between the
  // write and the count.
  let entriesTotal: number | null = null;
  if (cart.campaign && cart.entriesEarned > 0) {
    const { data: total, error } = await sb.rpc("add_purchase_entries", {
      p_campaign: cart.campaign.id,
      p_email: data.customer.email,
      p_first_name: data.customer.firstName,
      p_last_name: data.customer.lastName,
      p_phone: data.customer.phone || null,
      p_entries: cart.entriesEarned,
    });
    if (typeof total === "number" && total > 0) entriesTotal = total;
    if (error) {
      logDbError("checkout entries", error);
      await notifyOwner({
        kind: "order_error",
        severity: "urgent",
        message: `Order ${number} did not receive its ${cart.entriesEarned} entries.`,
        order_number: number,
        email: data.customer.email,
      });
    }
  }

  const email = renderOrderConfirmation({
    orderNumber: number,
    firstName: data.customer.firstName,
    shipLines: cart.shipLines.map(toEmailLine),
    pickupLines: cart.pickupLines.map(toEmailLine),
    subtotalCents: cart.subtotalCents,
    taxCents: cart.taxCents,
    shippingCents: cart.shippingCents,
    totalCents: cart.totalCents,
    shipTo: data.shipping
      ? {
          name: `${data.customer.firstName} ${data.customer.lastName}`,
          line1: data.shipping.line1,
          line2: data.shipping.line2 || null,
          city: data.shipping.city,
          region: data.shipping.region,
          postalCode: data.shipping.postalCode,
        }
      : null,
    entriesAwarded: cart.entriesEarned,
    // Null when the entry write failed. The buyer is better served by an
    // email that says nothing about a total than by one quoting a number
    // that never made it into the database.
    entriesTotal,
    campaignTitle: cart.campaign?.title ?? null,
    cardBrand: charge.cardBrand,
    cardLast4: charge.cardLast4,
    confirmationToken: token,
  });

  // Never allowed to fail the order: sendEmail resolves a result, it does
  // not throw, and a false here only leaves confirmation_sent_at null.
  const sent = await sendEmail({
    to: data.customer.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    orderNumber: number,
  });
  if (sent.sent) {
    await sb
      .from("orders")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", order.id);
  } else {
    console.error(`Order ${number}: confirmation not sent — ${sent.detail}`);
  }

  await notifyOwner({
    kind: "order",
    order_number: number,
    total_cents: cart.totalCents,
    name: `${data.customer.firstName} ${data.customer.lastName}`,
    email: data.customer.email,
    phone: data.customer.phone || null,
    ships: cart.shipLines.map((l) => l.name),
    collects: cart.pickupLines.map((l) => l.name),
    entries_awarded: cart.entriesEarned,
    confirmation_emailed: sent.sent,
  });

  revalidatePath("/inventory");
  revalidatePath("/featured");
  return { ok: true, orderNumber: number, token };
}

function toEmailLine(line: {
  name: string;
  size: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}) {
  return {
    name: line.name,
    size: line.size,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    lineTotalCents: line.lineTotalCents,
  };
}

/** A held claim, and enough to undo it. */
type Claim =
  | { kind: "unit"; itemId: string }
  | { kind: "variant"; variantId: string; quantity: number };

/** Puts unsold claims back. Only ever called before a successful charge. */
async function releaseClaims(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  claims: Claim[],
): Promise<void> {
  const unitIds = claims.filter((c) => c.kind === "unit").map((c) => c.itemId);
  if (unitIds.length > 0) {
    const { error } = await sb
      .from("items")
      .update({ status: "available" })
      .in("id", unitIds)
      .eq("status", "reserved");
    if (error) logDbError("checkout release", error);
  }
  for (const claim of claims) {
    if (claim.kind !== "variant") continue;
    const { error } = await sb.rpc("release_variant_stock", {
      p_variant: claim.variantId,
      p_qty: claim.quantity,
    });
    if (error) logDbError("checkout release variant", error);
  }
}
