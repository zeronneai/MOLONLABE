"use server";

// Entry capture for the sweepstakes.
//
// Only the free method writes here today. The paid method needs a
// completed checkout, and checkout is stubbed until the payment provider
// is live — see lib/payments. Nothing in this file is reachable from the
// intro game; that game grants a discount code and nothing else.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getSupabase } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/notify";
import { logDbError } from "@/lib/db/log";

const entrySchema = z.object({
  campaign_id: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "That sweepstakes is no longer open.",
    ),
  first_name: z.string().trim().min(1, "First name, please.").max(80),
  last_name: z.string().trim().min(1, "Last name, please.").max(80),
  email: z.string().trim().email("That email doesn't look right.").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  // Honeypot: humans never see it, bots fill it.
  website: z.string().max(0),
});

export type EntryState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof entrySchema>, string>>;
};

export async function submitFreeEntry(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const parsed = entrySchema.safeParse({
    campaign_id: formData.get("campaign_id") ?? "",
    first_name: formData.get("first_name") ?? "",
    last_name: formData.get("last_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      // A filled honeypot: pretend success, write nothing.
      if (key === "website") return { status: "success" };
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors as EntryState["fieldErrors"],
    };
  }

  const data = parsed.data;
  const sb = getServiceSupabase() ?? getSupabase();
  if (!sb) {
    return {
      status: "error",
      message:
        "We can't take entries right now. Call the shop and we'll enter you by hand.",
    };
  }

  // The campaign has to be open. Checked server-side so a stale page or a
  // hand-crafted post can't enter a closed sweepstakes.
  const { data: campaign } = await sb
    .from("campaigns")
    .select("id, title, status, closes_at")
    .eq("id", data.campaign_id)
    .maybeSingle();
  if (!campaign || campaign.status !== "live") {
    return { status: "error", message: "That sweepstakes is closed." };
  }
  if (campaign.closes_at && new Date(campaign.closes_at) < new Date()) {
    return { status: "error", message: "That sweepstakes has closed." };
  }

  // One free entry per person per campaign. A second attempt is not an
  // error the entrant needs to see — they are already in.
  const { data: existing } = await sb
    .from("entrants")
    .select("id, entry_method")
    .eq("campaign_id", data.campaign_id)
    .ilike("email", data.email)
    .maybeSingle();

  if (existing) {
    return {
      status: "success",
      message: "You were already entered — you're on the list.",
    };
  }

  const { error } = await sb.from("entrants").insert({
    campaign_id: data.campaign_id,
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    phone: data.phone || null,
    entry_count: 1,
    entry_method: "free",
    source: "online",
  });

  if (error) {
    logDbError("submitFreeEntry insert", error);
    return {
      status: "error",
      message: "Something went sideways saving that. Try again, or call the shop.",
    };
  }

  await notifyOwner({
    kind: "entry",
    name: `${data.first_name} ${data.last_name}`,
    email: data.email,
    phone: data.phone || null,
    campaign: campaign.title,
    method: "free",
  });

  revalidatePath("/featured");
  return { status: "success" };
}
