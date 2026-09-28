"use server";

// Changing your own password.
//
// Anyone signed in to the admin can change their own, and someone signed
// in with a password another person set (every new account, and the two
// that existed when this arrived) must, before the admin shows them
// anything else. Supabase stores the password: this checks the current
// one, asks Supabase to update it for the signed-in user, signs that
// user out everywhere else, and records the change. The password itself
// is never logged, stored by this code, or sent anywhere but Supabase.

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { requireStaffForPassword } from "@/lib/admin/staff";
import { logDbError } from "@/lib/db/log";
import { passwordProblem } from "@/lib/admin/password";

export type PasswordState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Which field the message is about, so the form can point at it. */
  field?: "current" | "next" | "confirm";
  /** True when this was the forced first change, and the admin is now open. */
  unlocked?: boolean;
};

/** Supabase's reasons for calling a password weak, in words. */
const REASONS: Record<string, string> = {
  length: `it is shorter than Supabase allows`,
  characters: "it needs a mix of character types (Supabase's setting)",
  pwned: "it has appeared in a public list of leaked passwords",
};

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const staff = await requireStaffForPassword();
  if (!staff) return { status: "error", message: "Not signed in." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const email = staff.user.email ?? "";

  if (!current) return { status: "error", field: "current", message: "Enter your current password." };
  const problem = passwordProblem(next, { current, email, name: staff.name });
  if (problem) return { status: "error", field: "next", message: problem };
  if (next !== confirm)
    return { status: "error", field: "confirm", message: "The two new passwords don't match. Type the new one again in both boxes." };

  // The current password, checked on a separate session that is thrown
  // away at once, so the admin's own session is untouched. Without this,
  // anyone who found the admin left signed in could change the password
  // and lock its owner out.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon || !email) return { status: "error", message: "Supabase isn't configured." };
  const check = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: wrong } = await check.auth.signInWithPassword({ email, password: current });
  if (wrong) {
    return {
      status: "error",
      field: "current",
      message: /rate|too many/i.test(wrong.message)
        ? "Too many attempts. Wait a minute and try again."
        : "That isn't your current password.",
    };
  }
  await check.auth.signOut({ scope: "local" }).catch(() => {});

  // Supabase's own update, for the signed-in user.
  const { error: updateError } = await staff.sb.auth.updateUser({ password: next });
  if (updateError) {
    const code = (updateError as { code?: string }).code;
    if (code === "weak_password") {
      const reasons = ((updateError as { reasons?: string[] }).reasons ?? [])
        .map((r) => REASONS[r] ?? r)
        .join("; ");
      return {
        status: "error",
        field: "next",
        message: `That password is too weak${reasons ? `: ${reasons}` : ""}. Choose another.`,
      };
    }
    if (code === "same_password") {
      return { status: "error", field: "next", message: "That is your current password. Choose a new one." };
    }
    console.error("changePassword updateUser:", updateError.message);
    return { status: "error", message: "The password could not be changed. Nothing has changed. Try again." };
  }

  // Recorded, and the forced-change flag cleared: the database only
  // clears it because the stored password really is different now.
  const { data: wasForced, error: recordError } = await staff.sb.rpc("record_password_change");
  if (recordError) {
    logDbError("changePassword record_password_change", recordError);
    return {
      status: "error",
      message:
        "Your password was changed, but the admin could not record it. Sign out and sign in with the new password; if you are asked to change it again, call Purple Roots.",
    };
  }

  // Everywhere else this account is signed in (including anywhere it was
  // signed in with the old password) is signed out now.
  await staff.sb.auth.signOut({ scope: "others" }).catch((e) => {
    console.error("changePassword sign out others:", e);
  });

  revalidatePath("/admin", "layout");
  return {
    status: "success",
    unlocked: wasForced === true,
    message: wasForced
      ? "Your password is set. Only you know it now."
      : "Your password is changed. Anywhere else you were signed in has been signed out.",
  };
}
