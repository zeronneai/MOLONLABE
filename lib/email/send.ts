import "server-only";

// Transactional email transport.
//
// This is the first customer-facing email the site sends — notifyOwner
// posts to a Google Apps Script and only ever reaches the owner, so there
// was nothing to reuse.
//
// Resend because it is one authenticated POST with no SDK, which keeps
// the dependency surface at zero. Swapping it for Postmark or SES is a
// change to this one function.
//
// Unconfigured, it reports failure rather than pretending to succeed. A
// confirmation that silently went nowhere is worse than a visible gap:
// the order page tells the buyer, and the order row keeps
// confirmation_sent_at null so the owner can see which ones need sending
// by hand.

export type SendResult = { sent: boolean; detail: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Escape hatch for tests, which point this at a local double so the
 * confirmation email can be asserted on as it is actually rendered and
 * sent. Same shape as `AUTHORIZENET_API_BASE`, and ignored the moment a
 * real key is a production one — a stray variable must not be able to
 * redirect customer mail.
 */
function endpoint(): string {
  const override = process.env.RESEND_API_BASE?.trim();
  if (!override) return RESEND_ENDPOINT;
  return override.startsWith("http://127.0.0.1") ||
    override.startsWith("http://localhost")
    ? override
    : RESEND_ENDPOINT;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<SendResult> {
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
    const response = await fetch(endpoint(), {
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
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { sent: false, detail: `Resend HTTP ${response.status} ${body.slice(0, 200)}` };
    }
    return { sent: true, detail: "sent" };
  } catch (err) {
    return {
      sent: false,
      detail: `Resend unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
