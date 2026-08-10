"use client";

// Minimal magic-link login — docs/admin-decisions.md. Skull, one email
// field, one CTA. No password flow, no signup: the owner account exists
// already; unknown emails get nothing.

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { LOGO_URL } from "@/lib/brand";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) {
      setState("error");
      setError("Supabase isn't configured.");
      return;
    }
    setState("sending");
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/auth/callback`,
        shouldCreateUser: false,
      },
    });
    if (err) {
      setState("error");
      setError("Couldn't send the link. Check the address and try again.");
      return;
    }
    setState("sent");
  };

  return (
    <div className="px-page flex min-h-svh flex-col items-start justify-center pb-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="Molon Labe Firearms" className="h-16 w-auto" />

      {state === "sent" ? (
        <p aria-live="polite" className="mt-10 max-w-sm text-muted">
          Check your email. The sign-in link is on its way.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-10 w-full max-w-sm">
          <label className="field-label" htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
          {state === "error" && (
            <p aria-live="polite" className="mt-3 text-[11px] text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={state === "sending"}
            className="cta-primary mt-8 disabled:opacity-50"
          >
            {state === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}
