"use server";

// Checkout. The only place money moves.
//
// Order of operations matters more here than anywhere else in the app:
//
//   1. Price the cart from the database. The browser's numbers are never
//      trusted, or read at all.
//   2. Claim the stock, and claim the spots. Inventory rows are
//      individual units, so the claim is a conditional update that only
//      succeeds if the item is still available. Spots are claimed by a
//      function using `for update skip locked`, which is what stops two
//      people buying the same last spot at the same instant. Both close
//      the window between deciding to sell and being paid.
//   3. Charge. Only now, with the goods held.
//   4. Record. Order, lines, spots sold, item finalisation.
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
import { GAME_TERMS_TEXT } from "@/lib/games/terms";
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
        itemId: z.string().min(1).optional(),
        gameId: z.string().min(1).optional(),
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
  /**
   * Only demanded when the cart holds spots, and checked again on the
   * server below rather than trusted from the form — a cart can gain a
   * spot line between the page rendering and the post arriving.
   */
  gameTermsAccepted: z.boolean().optional(),
  /**
   * Opt-in, and it stays false unless the buyer ticked the box. Never
   * inferred from anything else.
   */
  showName: z.boolean().optional(),
  /**
   * One per rendered checkout form. The server refuses to charge twice
   * for the same one, which is what protects against a double-submit
   * that a disabled button cannot — a reload, a slow network retry, or
   * two tabs.
   */
  idempotencyKey: z.string().min(8).max(64).optional(),
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
    // Spots are claimed below, by their own function. They are not rows
    // on a shelf and the inventory claim would refuse them.
    if (line.gameId) continue;
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

  // Spots, claimed the same way and for the same reason. The function
  // is all-or-nothing: asking for four when three remain takes none,
  // rather than handing somebody three of the four they are paying for.
  let claimedSpots: number[] = [];
  if (cart.spotGame && cart.spotCount > 0) {
    if (!data.gameTermsAccepted) {
      await releaseClaims(sb, claims);
      return {
        ok: false,
        message: "Accept the game terms before we can take payment.",
      };
    }
    const { data: spots, error } = await sb.rpc("claim_game_spots", {
      p_game: cart.spotGame.id,
      p_qty: cart.spotCount,
    });
    if (error) logDbError("checkout claim spots", error);
    claimedSpots = spots ?? [];
    if (claimedSpots.length !== cart.spotCount) {
      await releaseClaims(sb, claims);
      return {
        ok: false,
        message:
          cart.spotCount === 1
            ? "That spot went while you were checking out. Nothing has been charged."
            : `There aren't ${cart.spotCount} spots left any more. Nothing has been charged.`,
      };
    }
    claims.push({
      kind: "spots",
      gameId: cart.spotGame.id,
      spots: claimedSpots,
    });
  }

  // Layer 2 of 3 against a double charge, and the only one that holds
  // against a reload or a second tab. Claimed BEFORE the gateway call:
  // whoever wins this insert is the only request allowed to charge.
  const key = data.idempotencyKey ?? null;
  if (key) {
    const { data: claim, error: claimError } = await sb.rpc("claim_checkout", {
      p_key: key,
    });
    if (claimError) logDbError("checkout claim key", claimError);

    if (typeof claim === "string" && claim.startsWith("done:")) {
      // This exact submission already went through. Hand back the order
      // it produced rather than charging again.
      const existing = claim.slice(5);
      await releaseClaims(sb, claims);
      const { data: row } = await sb
        .from("orders")
        .select("order_number, confirmation_token")
        .eq("order_number", existing)
        .maybeSingle();
      if (row) {
        return {
          ok: true,
          orderNumber: row.order_number,
          token: row.confirmation_token,
        };
      }
    }

    if (claim === "in_flight") {
      // Another request with this key is mid-charge. Refuse without
      // touching the card, and do NOT release its claims — they belong
      // to the attempt that is still running.
      return {
        ok: false,
        message:
          "This payment is already going through. Give it a few seconds — don't pay again.",
      };
    }
  }

  // 3. Charge.
  const number = orderNumber();
  const charge = await provider.charge({
    amountCents: cart.totalCents,
    opaqueData: data.opaqueData,
    invoiceNumber: number,
    idempotencyKey: key ?? undefined,
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
    // No money moved, so the buyer must be able to try again with the
    // same form. Holding the key here would refuse their second, honest
    // attempt as a duplicate.
    if (key) await sb.rpc("release_checkout", { p_key: key });
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
      game_id: cart.spotGame?.id ?? null,
      // Same pairing as the firearms disclaimer: the timestamp means
      // nothing without the words it refers to, so both or neither.
      game_terms_accepted_at: cart.spotGame ? acceptedAt : null,
      game_terms_text: cart.spotGame ? GAME_TERMS_TEXT : null,
      gateway: provider.name,
      gateway_transaction_id: charge.transactionId,
      gateway_auth_code: charge.authCode,
      gateway_response_code: charge.responseCode,
      card_brand: charge.cardBrand,
      card_last4: charge.cardLast4,
      confirmation_token: token,
      idempotency_key: key,
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
      failure: "charged_not_saved",
      message: "A card was charged but the order could not be saved.",
      transaction_id: charge.transactionId,
      order_number: number,
      total_cents: cart.totalCents,
      email: data.customer.email,
      // Claimed before the charge and deliberately not released here —
      // the customer paid. The recovery steps need to name it, because a
      // refund without putting it back leaves it invisible on the site.
      held: [
        ...cart.lines
          .filter((l) => !l.gameId)
          .map((l) => ({
            name: l.name,
            size: l.size,
            quantity: l.quantity,
            hold: l.variantId ? ("stock" as const) : ("reserved" as const),
          })),
        // Spots are the urgent half of this: a held spot releases itself
        // after 15 minutes, so unlike a reserved item it will quietly go
        // back on sale to somebody else while this order sits unrecorded.
        ...(cart.spotGame && claimedSpots.length > 0
          ? [
              {
                name: `${cart.spotGame.title} — ${claimedSpots.length === 1 ? "spot" : "spots"} ${claimedSpots.join(", ")}`,
                size: null,
                quantity: claimedSpots.length,
                hold: "spot" as const,
              },
            ]
          : []),
      ],
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
      line_type: line.gameId ? "game_spot" : "inventory",
      item_id: line.gameId ? null : line.itemId,
      game_id: line.gameId,
      // Which spots, by number, on the order itself — so the receipt can
      // say "spots 12, 13 and 40" without joining back to the pool.
      spot_numbers: line.gameId ? claimedSpots : null,
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
      failure: "lines_not_saved",
      message: "Order saved but its line items did not.",
      order_number: number,
    });
  }

  // The spots are the buyer's now. `sell_game_spots` also closes the
  // game if that was the last one — derived from a count inside the same
  // statement rather than from anything this code passes in, so a
  // miscount here cannot close a game early.
  if (cart.spotGame && claimedSpots.length > 0) {
    const { error } = await sb.rpc("sell_game_spots", {
      p_game: cart.spotGame.id,
      p_spots: claimedSpots,
      p_order: order.id,
      p_first_name: data.customer.firstName,
      p_last_name: data.customer.lastName,
      p_email: data.customer.email,
      p_phone: data.customer.phone || null,
      // Opt-in. False unless the box was ticked, never inferred.
      p_show_name: data.showName === true,
    });
    if (error) {
      logDbError("checkout sell spots", error);
      await notifyOwner({
        kind: "order_error",
        severity: "urgent",
        failure: "spots_not_sold",
        message: `Order ${number} paid for ${claimedSpots.length} spots that were not recorded as sold.`,
        order_number: number,
        email: data.customer.email,
        spot_numbers: claimedSpots,
        game: cart.spotGame.title,
      });
    }
    revalidatePath("/featured");
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
    spots: cart.spotGame
      ? {
          game: cart.spotGame.title,
          numbers: claimedSpots,
          totalSpots: cart.spotGame.totalSpots,
          unitPriceCents: cart.spotGame.spotPriceCents,
        }
      : null,
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

  // `ships` and `collects` stay as bare names because the owner's sheet
  // already has columns for them. The detailed arrays beside them are
  // what the readable summary is built from.
  const toNotifyLine = (l: {
    name: string;
    size: string | null;
    quantity: number;
    lineTotalCents: number;
  }) => ({
    name: l.name,
    size: l.size,
    quantity: l.quantity,
    line_total_cents: l.lineTotalCents,
  });

  await notifyOwner({
    kind: "order",
    order_number: number,
    name: `${data.customer.firstName} ${data.customer.lastName}`,
    email: data.customer.email,
    phone: data.customer.phone || null,
    subtotal_cents: cart.subtotalCents,
    tax_cents: cart.taxCents,
    shipping_cents: cart.shippingCents,
    total_cents: cart.totalCents,
    card_brand: charge.cardBrand,
    card_last4: charge.cardLast4,
    ships: cart.shipLines.map((l) => l.name),
    collects: cart.pickupLines.map((l) => l.name),
    ship_lines: cart.shipLines.map(toNotifyLine),
    pickup_lines: cart.pickupLines.map(toNotifyLine),
    spot_numbers: claimedSpots,
    game: cart.spotGame?.title ?? null,
    confirmation_emailed: sent.sent,
  });

  // If that was the last spot, the game is now full and the owner has
  // something to do. Sent after the order notification so the two arrive
  // in the order they happened.
  if (cart.spotGame && claimedSpots.length > 0) {
    const { data: after } = await sb
      .from("games")
      .select("status, title, total_spots")
      .eq("id", cart.spotGame.id)
      .maybeSingle();
    if (after?.status === "full") {
      await notifyOwner({
        kind: "game_full",
        game: after.title,
        game_id: cart.spotGame.id,
        total_spots: after.total_spots,
        item: cart.spotGame.title,
      });
    }
  }

  // The attempt is now settled. A replay of the same key from here on
  // returns this order instead of charging.
  if (key) {
    await sb.rpc("finish_checkout", {
      p_key: key,
      p_order: number,
      p_outcome: "paid",
    });
  }

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
  | { kind: "variant"; variantId: string; quantity: number }
  | { kind: "spots"; gameId: string; spots: number[] };

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
    if (claim.kind === "spots") {
      const { error } = await sb.rpc("release_game_spots", {
        p_game: claim.gameId,
        p_spots: claim.spots,
      });
      if (error) logDbError("checkout release spots", error);
      continue;
    }
    if (claim.kind !== "variant") continue;
    const { error } = await sb.rpc("release_variant_stock", {
      p_variant: claim.variantId,
      p_qty: claim.quantity,
    });
    if (error) logDbError("checkout release variant", error);
  }
}
