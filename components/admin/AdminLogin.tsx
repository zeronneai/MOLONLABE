"use client";

// Minimal password login — docs/admin-decisions.md. Skull, two underline
// fields, one CTA. No signup, no reset link: the owner account is
// managed in the Supabase dashboard. Failures are always the same
// generic message, never revealing which field was wrong.

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { LOGO_URL } from "@/lib/brand";

// Device-local lockout: 5 straight failures → 60s cooldown. Supabase's
// own auth rate limits are the real backstop; this just keeps the UI
// honest about it.
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000;
const LOCK_KEY = "mlf_admin_lock";

function readLock(): { fails: number; until: number } {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LOCK_KEY) ?? "");
    if (parsed && typeof parsed === "object")
      return { fails: 0, until: 0, ...(parsed as object) };
  } catch {
    // absent or corrupt — start clean
  }
  return { fails: 0, until: 0 };
}

function writeLock(lock: { fails: number; until: number }) {
  try {
    window.localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  } catch {
    // storage unavailable — lockout just won't survive a reload
  }
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const fails = useRef(0);

  useEffect(() => {
    const lock = readLock();
    fails.current = lock.fails;
    setLockedUntil(lock.until);
  }, []);

  const locked = lockedUntil > now;

  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || busy) return;
    const sb = getBrowserSupabase();
    if (!sb) {
      setError("Supabase isn't configured.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    if (err) {
      fails.current += 1;
      if (fails.current >= MAX_ATTEMPTS) {
        const until = Date.now() + COOLDOWN_MS;
        fails.current = 0;
        writeLock({ fails: 0, until });
        setLockedUntil(until);
        setNow(Date.now());
      } else {
        writeLock({ fails: fails.current, until: 0 });
      }
      setError("Incorrect email or password");
      setBusy(false);
      return;
    }
    writeLock({ fails: 0, until: 0 });
    // Full navigation so server components read the fresh session cookie.
    window.location.assign("/admin/inventory");
  };

  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  return (
    <div className="px-page flex min-h-svh flex-col items-start justify-center pb-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="Molon Labe Firearms" className="h-16 w-auto" />

      <form onSubmit={submit} className="mt-10 w-full max-w-sm">
        <label className="field-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
        />

        <label className="field-label mt-8" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
        />

        {(error || locked) && (
          <p aria-live="polite" className="mt-4 text-[11px] text-danger">
            {locked ? `Too many attempts. Try again in ${remaining}s.` : error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || locked}
          className="cta-primary mt-8 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
