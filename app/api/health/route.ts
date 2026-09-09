import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Diagnostic endpoint: shows exactly why Supabase queries succeed or fail
// at request time, without exposing secrets. Safe to leave deployed —
// keys are described (role, length, whitespace), never echoed.

export const dynamic = "force-dynamic";

type KeyReport = {
  present: boolean;
  length?: number;
  hasSurroundingWhitespace?: boolean;
  validJwt?: boolean;
  role?: string | null;
  projectRef?: string | null;
  expired?: boolean | null;
};

function describeKey(raw: string | undefined): KeyReport {
  if (!raw) return { present: false };
  const trimmed = raw.trim();
  const report: KeyReport = {
    present: true,
    length: raw.length,
    hasSurroundingWhitespace: raw !== trimmed,
    validJwt: false,
    role: null,
    projectRef: null,
    expired: null,
  };
  try {
    const payload = JSON.parse(
      Buffer.from(trimmed.split(".")[1], "base64").toString("utf8"),
    ) as { role?: string; ref?: string; exp?: number };
    report.validJwt = true;
    report.role = payload.role ?? null;
    report.projectRef = payload.ref ?? null;
    report.expired = payload.exp ? payload.exp * 1000 < Date.now() : null;
  } catch {
    // not a JWT — leave validJwt false
  }
  return report;
}

function describeUrl(raw: string | undefined) {
  if (!raw) return { present: false as const };
  const trimmed = raw.trim();
  let host: string | null = null;
  let parseError: string | null = null;
  try {
    host = new URL(trimmed).host;
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }
  return {
    present: true as const,
    host,
    hasSurroundingWhitespace: raw !== trimmed,
    parseError,
  };
}

async function probe(url: string, key: string, label: string) {
  try {
    const sb = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("items")
      .select("slug, status")
      .neq("status", "hidden")
      .limit(5);
    if (error) {
      return {
        ok: false,
        error: {
          code: error.code ?? null,
          message: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
        },
      };
    }
    return { ok: true, rows: data.length, sample: data.map((r) => r.slug) };
  } catch (e) {
    // network / fetch-level failure, not a PostgREST error
    return {
      ok: false,
      error: {
        code: "FETCH_FAILED",
        message: e instanceof Error ? e.message : String(e),
        cause:
          e instanceof Error && e.cause
            ? String((e.cause as Error).message ?? e.cause)
            : null,
        label,
      },
    };
  }
}

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rawService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    runtime: process.env.VERCEL ? "vercel" : "local",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: describeUrl(rawUrl),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: describeKey(rawAnon),
      SUPABASE_SERVICE_ROLE_KEY: describeKey(rawService),
    },

    // Which of the two mail paths are actually configured. Presence only
    // — a key is never echoed, and the from-address is shown because a
    // typo in it is a common cause of silent non-delivery.
    email: {
      // Customer order confirmations, via Resend. Both are required; with
      // either missing the order still completes and is recorded, and the
      // receipt page says the copy could not be sent.
      orderConfirmations: {
        provider: "resend",
        configured: Boolean(
          process.env.RESEND_API_KEY?.trim() &&
            process.env.ORDER_EMAIL_FROM?.trim(),
        ),
        RESEND_API_KEY: { present: Boolean(process.env.RESEND_API_KEY?.trim()) },
        ORDER_EMAIL_FROM: process.env.ORDER_EMAIL_FROM?.trim() || null,
      },
      // Everything that reaches the owner — inquiries, transfer requests,
      // free entries, order placed, and the urgent order failures. Missing
      // means those notifications are silently dropped.
      ownerNotifications: {
        provider: "google apps script",
        configured: Boolean(process.env.GOOGLE_SCRIPT_URL?.trim()),
        GOOGLE_SCRIPT_URL: {
          present: Boolean(process.env.GOOGLE_SCRIPT_URL?.trim()),
        },
      },
    },

    payments: {
      NEXT_PUBLIC_AUTHORIZENET_ENV:
        process.env.NEXT_PUBLIC_AUTHORIZENET_ENV?.trim() || null,
      AUTHORIZENET_API_LOGIN_ID: {
        present: Boolean(process.env.AUTHORIZENET_API_LOGIN_ID?.trim()),
      },
      AUTHORIZENET_TRANSACTION_KEY: {
        present: Boolean(process.env.AUTHORIZENET_TRANSACTION_KEY?.trim()),
      },
      NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY: {
        present: Boolean(
          process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY?.trim(),
        ),
      },
    },

    // The confirmation email's links are absolute and are built from this.
    NEXT_PUBLIC_SITE_URL: describeUrl(process.env.NEXT_PUBLIC_SITE_URL),
  };

  if (rawUrl?.trim() && rawAnon?.trim()) {
    report.anonQuery = await probe(rawUrl.trim(), rawAnon.trim(), "anon");
  } else {
    report.anonQuery = { ok: false, error: { message: "URL or anon key missing" } };
  }

  if (rawUrl?.trim() && rawService?.trim()) {
    report.serviceQuery = await probe(rawUrl.trim(), rawService.trim(), "service");
  } else {
    report.serviceQuery = { skipped: "SUPABASE_SERVICE_ROLE_KEY not set" };
  }

  return NextResponse.json(report, {
    headers: { "cache-control": "no-store" },
  });
}
