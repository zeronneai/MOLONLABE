import "server-only";

// Transactional email transport — the customer's order confirmation, and
// nothing else. Owner notifications go through lib/notify.ts.
//
// Two providers, chosen by EMAIL_PROVIDER:
//
//   apps_script  (default)  POSTs the rendered email to GOOGLE_SCRIPT_URL
//                           with kind "order_confirmation". The script
//                           sends it on. Free, works today, and needs no
//                           verified domain — which is why it is the
//                           default while the client has no domain yet.
//
//   resend                  One authenticated POST to Resend. Needs a
//                           verified sending domain. Better deliverability
//                           and no daily cap, so this is where the
//                           customer confirmation should end up once the
//                           domain exists.
//
// The switch is one variable on purpose. Nothing else changes when it
// moves: both paths take the same rendered HTML and text, so the design,
// the legal copy and the entry total live in one place regardless of who
// carries the message.
//
// Unconfigured, this reports failure rather than pretending to succeed. A
// confirmation that silently went nowhere is worse than a visible gap:
// the receipt page tells the buyer, and the order row keeps
// confirmation_sent_at null so the owner can see which ones need sending
// by hand.

export type SendResult = { sent: boolean; detail: string };

export type EmailProvider = "apps_script" | "resend";

/** Which transport carries the customer confirmation. */
export function emailProvider(): EmailProvider {
  return process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend"
    ? "resend"
    : "apps_script";
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Escape hatch for tests, which point a provider at a local double so the
 * confirmation email can be asserted on as it is actually rendered and
 * sent. Same shape as `AUTHORIZENET_API_BASE`. Only a localhost address
 * is honoured — a stray variable must not be able to redirect customer
 * mail to somewhere real.
 */
function localOverride(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.startsWith("http://127.0.0.1") ||
    value.startsWith("http://localhost")
    ? value
    : null;
}

type SendParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Carried through to the script so a sheet row can name the order. */
  orderNumber?: string;
};

export async function sendEmail(params: SendParams): Promise<SendResult> {
  return emailProvider() === "resend"
    ? sendViaResend(params)
    : sendViaAppsScript(params);
}

/**
 * Hands the already-rendered email to the Apps Script.
 *
 * The script is a courier, not an author: it receives finished `html` and
 * `text` and sends them. Rebuilding the email inside the script would put
 * a second copy of the design, the disclaimer and the entry total
 * somewhere no test can see.
 *
 * One honest limit on what a success means here. Apps Script answers 200
 * as soon as it has accepted the request, and its own mail send happens
 * after that, so `sent: true` means "the script took it", not "Gmail
 * delivered it". Under Resend the same flag means the provider accepted
 * the message for delivery — also not proof of arrival, but closer. A
 * script that wants to report a real failure can answer with a JSON body
 * of `{"ok": false, "error": "..."}` and it will be recorded as unsent.
 */
async function sendViaAppsScript(params: SendParams): Promise<SendResult> {
  const url =
    localOverride(process.env.GOOGLE_SCRIPT_BASE) ??
    process.env.GOOGLE_SCRIPT_URL?.trim();
  if (!url) {
    return {
      sent: false,
      detail: "Email is not configured (GOOGLE_SCRIPT_URL unset).",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "order_confirmation",
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        // Optional and only honoured if the Google account has it as a
        // verified alias. Left out entirely when unset, so the script
        // falls back to the account's own address.
        ...(process.env.ORDER_EMAIL_FROM?.trim()
          ? { from: process.env.ORDER_EMAIL_FROM.trim() }
          : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        ...(params.orderNumber ? { order_number: params.orderNumber } : {}),
        submitted_at: new Date().toISOString(),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        sent: false,
        detail: `Apps Script HTTP ${response.status} ${body.slice(0, 200)}`,
      };
    }

    // A script that says nothing is taken at its word. One that answers
    // with ok:false is believed.
    const body = await response.text().catch(() => "");
    try {
      const parsed: unknown = JSON.parse(body);
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as { ok?: unknown }).ok === false
      ) {
        const error = (parsed as { error?: unknown }).error;
        return {
          sent: false,
          detail: `Apps Script reported failure: ${
            typeof error === "string" ? error.slice(0, 200) : "no reason given"
          }`,
        };
      }
    } catch {
      // Not JSON. Apps Script commonly answers with HTML, which is not a
      // failure signal — only an explicit ok:false is.
    }
    return { sent: true, detail: "accepted by Apps Script" };
  } catch (err) {
    return {
      sent: false,
      detail: `Apps Script unreachable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

async function sendViaResend(params: SendParams): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  if (!key || !from) {
    return {
      sent: false,
      detail:
        "Email is not configured (RESEND_API_KEY / ORDER_EMAIL_FROM unset).",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(
      localOverride(process.env.RESEND_API_BASE) ?? RESEND_ENDPOINT,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
          ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        sent: false,
        detail: `Resend HTTP ${response.status} ${body.slice(0, 200)}`,
      };
    }
    return { sent: true, detail: "accepted by Resend" };
  } catch (err) {
    return {
      sent: false,
      detail: `Resend unreachable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
