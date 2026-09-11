// Payment provider seam.
//
// Fortis is out; Authorize.net is in, via Accept.js. The browser exchanges
// the card for a one-time nonce with Authorize.net directly, and only that
// nonce reaches this server. No primary account number, expiry or CVV ever
// touches our infrastructure, our logs or our database, which is what
// keeps the client in SAQ A rather than in scope for the full
// questionnaire.
//
// Everything behind this interface is swappable. Nothing above it knows
// the gateway's name.

import { authorizeNetProvider } from "./authorizenet";

export type OpaqueData = {
  dataDescriptor: string;
  dataValue: string;
};

export type ChargeRequest = {
  amountCents: number;
  opaqueData: OpaqueData;
  /** Shown on the buyer's statement and in the gateway's dashboard. */
  invoiceNumber: string;
  /**
   * One per rendered checkout form, carried through so two attempts from
   * the same form are recognisable as one intent in the gateway's own
   * records. Authorize.net has no idempotency-key header — its guard is
   * `duplicateWindow`, set in the request — so this is for tracing rather
   * than enforcement. The enforcement is `claim_checkout` server-side.
   */
  idempotencyKey?: string;
  description: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
  };
  billTo?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  ipAddress?: string | null;
};

export type ChargeSuccess = {
  ok: true;
  transactionId: string;
  authCode: string | null;
  responseCode: string;
  cardBrand: string | null;
  cardLast4: string | null;
};

export type ChargeFailure = {
  ok: false;
  /** Safe to show a buyer. Never contains gateway internals. */
  message: string;
  /** For the server log and the owner's notification. */
  detail: string;
  /** True when the card was refused, false for our own misconfiguration. */
  declined: boolean;
};

export type ChargeResult = ChargeSuccess | ChargeFailure;

export interface PaymentProvider {
  readonly name: string;
  /** False until real credentials exist; the UI reads this, never guesses. */
  readonly configured: boolean;
  /** Public values the browser needs to tokenize. Never secrets. */
  clientConfig(): { apiLoginId: string; clientKey: string; scriptUrl: string } | null;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

/**
 * Entry packs — buying entries directly rather than earning them by
 * spending — are defined but not implemented. Under the model we are
 * shipping, entries come from purchases, so packs may never be needed;
 * the type stays so the order model's second line type has a meaning, and
 * so adding them later is an implementation rather than a migration.
 */
export interface EntryPack {
  id: string;
  label: string;
  entries: number;
  priceCents: number;
}

export const ENTRY_PACKS: EntryPack[] = [];

export const unconfiguredProvider: PaymentProvider = {
  name: "none",
  configured: false,
  clientConfig: () => null,
  async charge(): Promise<ChargeResult> {
    return {
      ok: false,
      declined: false,
      message:
        "Card payments aren't switched on yet. Call the shop and we'll take it over the phone.",
      detail: "No payment provider configured.",
    };
  },
};

/**
 * The provider in force. `configured` is computed from the environment on
 * every call rather than cached at module load, so a build with no
 * credentials still imports cleanly and a preview that gains them does not
 * need a redeploy of this module to notice.
 */
export function getPaymentProvider(): PaymentProvider {
  return authorizeNetProvider.configured
    ? authorizeNetProvider
    : unconfiguredProvider;
}
