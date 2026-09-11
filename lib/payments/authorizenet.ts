// Authorize.net, charged with an Accept.js nonce.
//
// The browser sends card data straight to Authorize.net and gets back an
// opaque, single-use token. That token is all this file ever handles. If
// somebody dumped every variable in this module they would find no card
// number, and the token they did find would already be spent.
//
// Endpoints and the Accept.js script both switch on
// NEXT_PUBLIC_AUTHORIZENET_ENV. Getting that wrong is the classic way to
// put live cards through a sandbox or, far worse, test cards through
// production, so it is explicit rather than inferred from NODE_ENV.

import { centsToAmount } from "@/lib/money";
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
} from "./index";

const SANDBOX = {
  api: "https://apitest.authorize.net/xml/v1/request.api",
  script: "https://jstest.authorize.net/v1/Accept.js",
};
const PRODUCTION = {
  api: "https://api.authorize.net/xml/v1/request.api",
  script: "https://js.authorize.net/v1/Accept.js",
};

function endpoints() {
  const production =
    (process.env.NEXT_PUBLIC_AUTHORIZENET_ENV ?? "sandbox").toLowerCase() ===
    "production";
  const base = production ? PRODUCTION : SANDBOX;
  // Escape hatch for tests, which point this at a local double. Ignored
  // in production so a stray variable cannot redirect live charges.
  const override = process.env.AUTHORIZENET_API_BASE?.trim();
  return {
    api: !production && override ? override : base.api,
    script: base.script,
  };
}

function credentials() {
  return {
    apiLoginId: process.env.AUTHORIZENET_API_LOGIN_ID?.trim() ?? "",
    transactionKey: process.env.AUTHORIZENET_TRANSACTION_KEY?.trim() ?? "",
    clientKey: process.env.NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY?.trim() ?? "",
  };
}

/**
 * Authorize.net serves JSON with a UTF-8 byte order mark in front of it,
 * which JSON.parse rejects. This is not a quirk of one endpoint; it is
 * every JSON response the gateway returns, and it is the single most
 * common reason a first integration fails with "Unexpected token".
 */
function parseGatewayJson(body: string): unknown {
  return JSON.parse(body.replace(/^﻿/, "").trim());
}

type GatewayResponse = {
  transactionResponse?: {
    responseCode?: string;
    authCode?: string;
    transId?: string;
    accountNumber?: string;
    accountType?: string;
    messages?: { code?: string; description?: string }[];
    errors?: { errorCode?: string; errorText?: string }[];
  };
  messages?: {
    resultCode?: string;
    message?: { code?: string; text?: string }[];
  };
};

/** Authorize.net returns the masked card as "XXXX1111". */
function lastFour(masked: string | undefined): string | null {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

const DECLINE_MESSAGE =
  "That card was declined. Check the number, expiry and billing ZIP, or try another card.";
const GENERIC_MESSAGE =
  "We couldn't complete the payment. Nothing has been charged — try again, or call the shop.";

export const authorizeNetProvider: PaymentProvider = {
  name: "authorize.net",

  get configured() {
    const { apiLoginId, transactionKey, clientKey } = credentials();
    // All three, because a partial configuration fails at the worst
    // possible moment: the browser tokenizes fine on the public key and
    // the charge then dies on the missing secret, after the buyer has
    // typed their card in.
    return Boolean(apiLoginId && transactionKey && clientKey);
  },

  clientConfig() {
    const { apiLoginId, clientKey } = credentials();
    if (!apiLoginId || !clientKey) return null;
    return { apiLoginId, clientKey, scriptUrl: endpoints().script };
  },

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const { apiLoginId, transactionKey } = credentials();
    if (!apiLoginId || !transactionKey) {
      return {
        ok: false,
        declined: false,
        message: GENERIC_MESSAGE,
        detail: "Authorize.net credentials are missing.",
      };
    }
    if (!Number.isInteger(request.amountCents) || request.amountCents <= 0) {
      return {
        ok: false,
        declined: false,
        message: GENERIC_MESSAGE,
        detail: `Refusing to charge a non-positive amount: ${request.amountCents}`,
      };
    }

    const body = {
      createTransactionRequest: {
        merchantAuthentication: { name: apiLoginId, transactionKey },
        // Both capped by the gateway; over-length is rejected outright.
        // The merchant-side reference. Preferring the idempotency key
        // means two attempts from one form share a refId, so they sit
        // next to each other in the Merchant Interface rather than
        // looking like two unrelated sales.
        refId: (request.idempotencyKey ?? request.invoiceNumber).slice(0, 20),
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: centsToAmount(request.amountCents),
          payment: {
            opaqueData: {
              dataDescriptor: request.opaqueData.dataDescriptor,
              dataValue: request.opaqueData.dataValue,
            },
          },
          order: {
            invoiceNumber: request.invoiceNumber.slice(0, 20),
            description: request.description.slice(0, 255),
          },
          customer: { email: request.customer.email },
          billTo: {
            firstName: request.customer.firstName.slice(0, 50),
            lastName: request.customer.lastName.slice(0, 50),
            address: request.billTo?.address?.slice(0, 60) || undefined,
            city: request.billTo?.city?.slice(0, 40) || undefined,
            state: request.billTo?.state?.slice(0, 40) || undefined,
            zip: request.billTo?.zip?.slice(0, 20) || undefined,
            country: "US",
          },
          customerIP: request.ipAddress || undefined,
          transactionSettings: {
            setting: [
              // The gateway's own guard against a double submit: an
              // identical amount from the same card inside this window is
              // rejected as a duplicate rather than charged twice.
              { settingName: "duplicateWindow", settingValue: "120" },
            ],
          },
        },
      },
    };

    let raw: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const response = await fetch(endpoints().api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      raw = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          declined: false,
          message: GENERIC_MESSAGE,
          detail: `Gateway HTTP ${response.status}`,
        };
      }
    } catch (err) {
      // A timeout here is genuinely ambiguous: the charge may have gone
      // through. Saying "nothing has been charged" would be a guess, so
      // the buyer is pointed at the shop instead of at the retry button.
      return {
        ok: false,
        declined: false,
        message:
          "We couldn't reach the card processor. Don't retry — call the shop and we'll confirm whether it went through.",
        detail: `Gateway unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    let parsed: GatewayResponse;
    try {
      parsed = parseGatewayJson(raw) as GatewayResponse;
    } catch {
      return {
        ok: false,
        declined: false,
        message: GENERIC_MESSAGE,
        detail: "Gateway returned a body that was not JSON.",
      };
    }

    const tx = parsed.transactionResponse;
    const top = parsed.messages;

    // An Error result with no transactionResponse is our problem, not the
    // card's — bad credentials, a malformed request, a spent nonce.
    if (!tx || !tx.responseCode) {
      const first = top?.message?.[0];
      return {
        ok: false,
        declined: false,
        message: GENERIC_MESSAGE,
        detail: `Gateway rejected the request: ${first?.code ?? "?"} ${first?.text ?? "no message"}`,
      };
    }

    // 1 approved · 2 declined · 3 error · 4 held for review
    if (tx.responseCode !== "1") {
      const err = tx.errors?.[0];
      const declined = tx.responseCode === "2";
      const held = tx.responseCode === "4";
      return {
        ok: false,
        declined,
        message: held
          ? "That payment is being reviewed by the processor. We'll be in touch — don't try the card again."
          : declined
            ? DECLINE_MESSAGE
            : GENERIC_MESSAGE,
        detail: `responseCode=${tx.responseCode} ${err?.errorCode ?? ""} ${err?.errorText ?? ""}`.trim(),
      };
    }

    if (!tx.transId || tx.transId === "0") {
      // Approved with no usable transaction id is not something we can
      // record or refund against, so it is treated as a failure the owner
      // has to look at rather than a sale.
      return {
        ok: false,
        declined: false,
        message: GENERIC_MESSAGE,
        detail: "Gateway approved the charge but returned no transaction id.",
      };
    }

    return {
      ok: true,
      transactionId: tx.transId,
      authCode: tx.authCode || null,
      responseCode: tx.responseCode,
      cardBrand: tx.accountType || null,
      cardLast4: lastFour(tx.accountNumber),
    };
  },
};
