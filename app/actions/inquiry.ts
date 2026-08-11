"use server";

import { inquirySchema, type FormState } from "@/lib/forms/schema";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getSupabase } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/notify";
import { logDbError } from "@/lib/db/log";
import type { InquiryInsert } from "@/lib/database.types";

export async function submitInquiry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = inquirySchema.safeParse({
    type: formData.get("type"),
    item_id: formData.get("item_id") ?? "",
    item_slug: formData.get("item_slug") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    message: formData.get("message") ?? "",
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
      fieldErrors: fieldErrors as FormState["fieldErrors"],
    };
  }

  const data = parsed.data;

  // Prefer the server-only service-role client; fall back to the anon
  // client, which the RLS insert policy still permits.
  const sb = getServiceSupabase() ?? getSupabase();
  if (!sb) {
    return {
      status: "error",
      message:
        "We can't take submissions right now. Call the shop and we'll sort it out.",
    };
  }

  const row: InquiryInsert = {
    type: data.type,
    item_id: data.item_id || null,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    message: data.message || null,
  };

  const { error } = await sb.from("inquiries").insert(row);
  if (error) {
    logDbError("submitInquiry insert", error);
    return {
      status: "error",
      message:
        "Something went sideways saving that. Try again, or call the shop.",
    };
  }

  await notifyOwner({
    kind: "inquiry",
    ...row,
    item_slug: data.item_slug || null,
  });

  return { status: "success" };
}
