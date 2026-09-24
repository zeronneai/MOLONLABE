"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * A signed-in account the admin does not recognise, or an access check
 * that could not be completed. Says which, and offers the way out.
 */
export default function NoAccess({ reason }: { reason: "no-access" | "error" }) {
  const router = useRouter();
  const signOut = async () => {
    await getBrowserSupabase()?.auth.signOut();
    router.refresh();
  };
  return (
    <div className="px-page flex min-h-svh flex-col items-start justify-center">
      <p className="label text-danger">
        {reason === "no-access" ? "No access" : "Could not check access"}
      </p>
      <p className="mt-4 max-w-md text-muted">
        {reason === "no-access"
          ? "This account can sign in but has not been given access to the admin. The owner can add it."
          : "The admin could not confirm who you are just now. Reload the page. If it keeps happening, the database may be unreachable."}
      </p>
      <button type="button" onClick={signOut} className="control mt-8">
        Sign out
      </button>
    </div>
  );
}
