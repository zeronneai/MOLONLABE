"use client";

// The last resort: an error thrown in the root layout itself, where no
// other UI is guaranteed to exist. It has to render its own <html> and
// cannot rely on the stylesheet having loaded, so the few styles that
// matter are inline.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 1.25rem",
          backgroundColor: "#0b0a0c",
          color: "#f2efe7",
          fontFamily: "Archivo, system-ui, sans-serif",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#57b94a",
          }}
        >
          500
        </p>
        <h1
          style={{
            margin: "1.5rem 0 0",
            fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 0.92,
          }}
        >
          SOMETHING
          <br />
          JAMMED.
        </h1>
        <p style={{ marginTop: "1.5rem", maxWidth: "46ch", color: "#8a8b8f" }}>
          The whole page failed to start. Reload it, or call the shop at (915)
          497-0541 and we&apos;ll help you directly.
        </p>
        <div style={{ marginTop: "3rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 56,
              padding: "0 2rem",
              border: "1px solid #2e5f28",
              borderRadius: 2,
              backgroundColor: "#57b94a",
              color: "#0b0a0c",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 56,
              padding: "0 2rem",
              border: "1px solid #3a4048",
              borderRadius: 2,
              backgroundColor: "#1f2227",
              color: "#f2efe7",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Home
          </a>
        </div>
      </body>
    </html>
  );
}
