import "server-only";

import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSessionSupabase } from "@/lib/supabase/session";
import { logDbError } from "@/lib/db/log";
import { OWNER_ONLY } from "@/lib/admin/constants";

/**
 * Who is using the admin, and what they may do.
 *
 * Two roles. The owner can do everything. The manager runs the shop day
 * to day and cannot delete anything permanently, change tax, shipping or
 * the offer, export the entrant list, or manage accounts.
 *
 * THIS IS NOT THE LOCK. The database is: every restricted write is
 * refused by row level security for a manager's session whatever the
 * server sends (tests/db/roles.mjs). What is here is the second lock, and
 * the reason a manager is told "owner only" instead of watching a save
 * quietly change nothing, which is how RLS says no to an update.
 *
 * The name comes from the staff table, never from user metadata. Metadata
 * is editable by the user it describes, so a name read from it is a name
 * the person chose for themselves. The activity log is only worth having
 * if nobody can sign a line as somebody else.
 */
export type StaffRole = "owner" | "manager";

export type Staff = {
  sb: SupabaseClient<Database>;
  user: User;
  role: StaffRole;
  name: string;
  /**
   * True when the database has no staff table yet, meaning the roles
   * migration has not been applied. Everyone is treated as the owner,
   * which is exactly how the admin behaved before roles existed, and
   * the admin says so at the top of every page.
   */
  rolesMissing: boolean;
  /**
   * Signed in with a password somebody else set (every new account, and
   * the two that existed when this arrived). Until they choose their own,
   * the admin shows them only the change-password screen, every action
   * refuses, and the database treats them as not staff.
   */
  mustChangePassword: boolean;
};

/** The migration that brings roles in. Named wherever it is missing. */
export const ROLES_MIGRATION = "20260928100000_staff_roles.sql";

export { OWNER_ONLY };

/**
 * The signed-in person, or a reason there is none.
 *
 * Cached per request: the layout, the page and every action on it ask
 * the same question and should get one round trip, not five.
 */
export const getStaff = cache(async (): Promise<
  | { ok: true; staff: Staff }
  | { ok: false; reason: "unconfigured" | "signed-out" | "no-access" | "error" }
> => {
  const sb = await getSessionSupabase();
  if (!sb) return { ok: false, reason: "unconfigured" };
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: "signed-out" };

  type Row = { role: string; display_name: string; must_change_password?: boolean };
  const first = await sb
    .from("staff")
    .select("role, display_name, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  let data: Row | null = first.data;
  let error = first.error;
  // The code is deployed ahead of the own-passwords migration: the column
  // is not there yet. Ask again without it rather than lock everyone out.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const again = await sb
      .from("staff")
      .select("role, display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    data = again.data;
    error = again.error;
  }

  if (error) {
    // The table itself is missing: the code is deployed and the
    // migration is not. Refusing everybody here would lock the owner out
    // of the admin on deploy day for a reason he cannot see.
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        ok: true,
        staff: {
          sb, user, role: "owner", name: fallbackName(user), rolesMissing: true,
          mustChangePassword: false,
        },
      };
    }
    logDbError("getStaff", error);
    return { ok: false, reason: "error" };
  }
  if (!data) return { ok: false, reason: "no-access" };
  return {
    ok: true,
    staff: {
      sb,
      user,
      role: data.role === "owner" ? "owner" : "manager",
      name: data.display_name,
      rolesMissing: false,
      mustChangePassword: data.must_change_password === true,
    },
  };
});

/** Only used while the staff table does not exist. */
function fallbackName(user: User): string {
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name", "display_name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `Unnamed (${user.id.slice(0, 6)})`;
}

/**
 * Any member of staff, for the things both roles do. Not someone who
 * still has to set their own password: until they do, every action
 * refuses them, as the database does.
 */
export async function requireStaff(): Promise<Staff | null> {
  const r = await getStaff();
  return r.ok && !r.staff.mustChangePassword ? r.staff : null;
}

/** Any member of staff, including one who must change their password. */
export async function requireStaffForPassword(): Promise<Staff | null> {
  const r = await getStaff();
  return r.ok ? r.staff : null;
}

/**
 * A manager's attempt at something owner-only, refused in words.
 *
 * Written to the server log as well, because a refused attempt is itself
 * worth knowing about: either the interface offered something it should
 * not have, or somebody went round it.
 */
export function refuseManager(staff: Staff, what: string): { status: "error"; message: string } {
  console.warn(`Refused for a manager (${staff.name}): ${what}`);
  return { status: "error", message: OWNER_ONLY };
}
