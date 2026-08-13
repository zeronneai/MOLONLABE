"use client";

// The 500. Client component by contract — Next passes the error and a
// reset() that re-renders the segment, which is a real way back for a
// transient failure rather than a dead end.

import { useEffect } from "react";
import ErrorScreen from "@/components/ui/ErrorScreen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this to the server log entry.
    console.error("[500]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      headline={
        <>
          SOMETHING
          <br />
          JAMMED.
        </>
      }
      body="That's on us, not you. Try it again — if it keeps happening, the shop can sort you out directly."
      onRetry={reset}
      primary={{ href: "/inventory", text: "View inventory" }}
    />
  );
}
