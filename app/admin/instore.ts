"use server";

// Sales at the shop counter.
//
// A guide sold at the register is a real sale: the buyer holds real guide
// numbers and is in the drawing (rules clause 12), so it is recorded as an
// order, marked in store, and the website can no longer sell those
// numbers. No card is charged here and Authorize.net is never called; the
// money and the tax were taken at the register.
//
// The database does the work (record_in_store_sale and void_in_store_sale
// in supabase/migrations/20260930100000_in_store_sales.sql): numbers are
// taken with the same row locks online checkout uses, so a counter sale
// and an online purchase can never share a guide, and a void is refused
// by the database for anyone but the owner, and once the drop is drawn.
// This file checks the same things first, to say so in words, and does
// what the database cannot: the email, the guide, the log.

import { revalidatePath } from "next/cache";
import { after as afterResponse } from "next/server";
import { refuseManager, requireStaff } from "@/lib/admin/staff";
import { logActivity } from "@/lib/admin/audit";
import { logDbError } from "@/lib/db/log";
import { IN_STORE_ACKNOWLEDGEMENT } from "@/lib/games/terms";
import { guideSubject } from "@/lib/guides/availability";
import { renderOrderConfirmation } from "@/lib/email/orderConfirmation";
import { sendEmail } from "@/lib/email/send";
import { notifyOwner } from "@/lib/notify";
import { getServiceSupabase } from "@/lib/supabase/service";
import type { Json } from "@/lib/database.types";

export type InStoreState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** On success, what was recorded, so the screen can say it back. */
  sale?: { orderNumber: string; numbers: number[]; emailed: boolean | null };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same alphabet as online order numbers; the prefix says where it was sold. */
function orderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `MLF-S-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

function token(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function recordInStoreSale(
  _prev: InStoreState,
  formData: FormData,
): Promise<InStoreState> {
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "Not signed in." };
  const { sb } = staff;

  const gameId = String(formData.get("game_id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const qty = Math.floor(Number(formData.get("quantity") ?? 0));
  const agreed = formData.get("agreed") === "on";

  if (!gameId) return { status: "error", message: "Missing drop." };
  if (!firstName || !lastName)
    return { status: "error", message: "Enter the buyer's first and last name." };
  if (!phone)
    return { status: "error", message: "Enter the buyer's phone number, so the shop can reach them if they win." };
  if (email && !EMAIL.test(email))
    return { status: "error", message: "That email address doesn't look right. Leave it blank if the buyer gave none." };
  if (!Number.isFinite(qty) || qty < 1)
    return { status: "error", message: "Enter how many guides were sold." };
  if (!agreed)
    return { status: "error", message: "Tick the box to confirm the buyer was shown the rules and agreed." };

  const number = orderNumber();
  const confirmation = token();
  const { data, error } = await sb.rpc("record_in_store_sale", {
    p_game: gameId,
    p_qty: qty,
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email || null,
    p_phone: phone,
    p_ack: IN_STORE_ACKNOWLEDGEMENT,
    p_order_number: number,
    p_token: confirmation,
  });
  if (error || !data) {
    if (error) logDbError("recordInStoreSale", error);
    // The database's refusals are written for this screen: sold out, not
    // enough left, not staff. Anything else is not.
    const said = error?.message ?? "";
    const plain = /requested|sold out|already drawn|Only staff|Enter|shown the rules|no such drop/i.test(said);
    return {
      status: "error",
      message: plain ? said : "The sale could not be recorded. Nothing was saved. Try again, or call Purple Roots.",
    };
  }

  const sale = data as unknown as { order_id: string; numbers: number[] };
  const { data: game } = await sb
    .from("games")
    .select("title, total_spots, spot_price_cents, status")
    .eq("id", gameId)
    .maybeSingle();

  await logActivity(sb, staff, {
    action: "sale",
    entity: "game",
    entityId: gameId,
    entityLabel: game?.title ?? null,
    field: "in-store sale",
    after: {
      order: number,
      buyer: `${firstName} ${lastName}`,
      guides: sale.numbers,
      email: email || null,
    } as Json,
  });

  // The guide, if there is an address to send it to. What they bought is
  // a guide, so they should have it the same way an online buyer does.
  let emailed: boolean | null = null;
  if (email && game) {
    const service = getServiceSupabase();
    const guideFor = service ? await guideSubject(service, gameId) : null;
    const rendered = renderOrderConfirmation({
      orderNumber: number,
      firstName,
      shipLines: [],
      pickupLines: [],
      subtotalCents: qty * game.spot_price_cents,
      taxCents: 0,
      shippingCents: 0,
      totalCents: qty * game.spot_price_cents,
      shipTo: null,
      spots: {
        game: game.title,
        numbers: sale.numbers,
        totalSpots: game.total_spots,
        unitPriceCents: game.spot_price_cents,
      },
      cardBrand: null,
      cardLast4: null,
      confirmationToken: confirmation,
      guideFor,
      paidInStore: true,
    });
    const sent = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      orderNumber: number,
    });
    emailed = sent.sent;
    if (sent.sent && service) {
      const { error: stampError } = await service
        .from("orders")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", sale.order_id);
      if (stampError) logDbError("recordInStoreSale confirmation_sent_at", stampError);
    } else if (!sent.sent) {
      console.error(`In-store sale ${number}: guide email not sent: ${sent.detail}`);
    }
    // Warm the guide after the response, as checkout does. /guide builds
    // on demand anyway, so this is a head start, not the delivery.
    if (guideFor && service) {
      afterResponse(async () => {
        try {
          const { refreshGuide } = await import("@/lib/guides/build");
          await refreshGuide(service, gameId);
        } catch (e) {
          console.error(`In-store sale ${number}: guide warm-up threw:`, e);
        }
      });
    }
  }

  // The same alert an online sale that fills the drop sends: the owner
  // has a drawing to run.
  if (game?.status === "full") {
    await notifyOwner({
      kind: "game_full",
      game: game.title,
      game_id: gameId,
      total_spots: game.total_spots,
      item: game.title,
    });
  }

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/featured");
  revalidatePath("/games");
  revalidatePath("/");

  return {
    status: "success",
    message:
      `Recorded: ${sale.numbers.length === 1 ? "guide" : "guides"} ${sale.numbers.join(", ")} ` +
      `for ${firstName} ${lastName}, order ${number}.` +
      (emailed === true ? ` The guide was emailed to ${email}.` : "") +
      (emailed === false ? ` The guide email to ${email} did not send; give them the order number.` : ""),
    sale: { orderNumber: number, numbers: sale.numbers, emailed },
  };
}

export async function voidInStoreSale(
  _prev: InStoreState,
  formData: FormData,
): Promise<InStoreState> {
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "Not signed in." };
  if (staff.role !== "owner") return refuseManager(staff, "void an in-store sale");
  const { sb } = staff;
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { status: "error", message: "Missing sale." };

  const { data: order } = await sb
    .from("orders")
    .select("order_number, first_name, last_name, game_id, source, voided_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { status: "error", message: "That sale no longer exists." };
  const { data: line } = await sb
    .from("order_items")
    .select("spot_numbers")
    .eq("order_id", orderId)
    .maybeSingle();

  const { data: returned, error } = await sb.rpc("void_in_store_sale", { p_order: orderId });
  if (error) {
    logDbError("voidInStoreSale", error);
    const said = error.message ?? "";
    return {
      status: "error",
      message: /drawn|already voided|Only the owner|Only an in-store/i.test(said)
        ? said
        : "The sale could not be voided. Nothing changed.",
    };
  }

  const { data: game } = order.game_id
    ? await sb.from("games").select("title").eq("id", order.game_id).maybeSingle()
    : { data: null };
  await logActivity(sb, staff, {
    action: "void",
    entity: "game",
    entityId: order.game_id,
    entityLabel: game?.title ?? null,
    field: "in-store sale",
    before: {
      order: order.order_number,
      buyer: `${order.first_name} ${order.last_name}`,
      guides: line?.spot_numbers ?? [],
    } as Json,
    after: { returned_to_sale: returned ?? 0 } as Json,
  });

  if (order.game_id) revalidatePath(`/admin/games/${order.game_id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/featured");
  revalidatePath("/games");
  revalidatePath("/");
  return {
    status: "success",
    message: `Voided order ${order.order_number}. ${returned ?? 0} ${returned === 1 ? "guide is" : "guides are"} available again.`,
  };
}
