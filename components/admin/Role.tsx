"use client";

// Who is signed in, for the controls that differ by role.
//
// Provided once by AdminShell from the server's answer, so no component
// works it out for itself and no two can disagree. It decides what is
// SHOWN as available. It decides nothing about what is allowed: the
// database refuses a manager's restricted writes whatever the browser
// sends, and so do the server actions.

import { createContext, useContext } from "react";
import { OWNER_ONLY } from "@/lib/admin/constants";

export type Role = "owner" | "manager";

const RoleContext = createContext<Role>("manager");

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/**
 * Defaults to manager outside a provider, so a control rendered somewhere
 * unexpected fails closed: it shows as owner-only rather than as usable.
 */
export function useRole(): Role {
  return useContext(RoleContext);
}

export function useIsOwner(): boolean {
  return useRole() === "owner";
}

/** The line under a disabled control. Same words the server refuses with. */
export function OwnerOnlyNote({ className = "" }: { className?: string }) {
  return (
    <p data-owner-only className={`label mt-3 text-muted ${className}`}>
      {OWNER_ONLY}
    </p>
  );
}
