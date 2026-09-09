"use client";

// Checkout.
//
// The card inputs deliberately have no `name` attribute and are never
// read into React state that gets posted anywhere. Accept.js reads them,
// hands them to Authorize.net, and gives us back a one-time nonce. The
// only payment value that reaches our server is that nonce. This is what
// keeps card data out of our request logs, our error reports and our
// database, and it only holds if nobody ever "helpfully" adds a name or a
// controlled value to these four fields.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart/store";
import { quoteCart } from "@/app/actions/cart";
import { submitCheckout } from "@/app/actions/checkout";
import { formatUsd } from "@/lib/money";
import {
  FIREARM_DISCLAIMER,
  PICKUP_NOTICE,
  REFUND_POLICY,
  SHIPPING_NOTICE,
} from "@/lib/legal";
import { lineKey, type PricedCart } from "@/lib/cart/types";
import { receiptPath } from "@/lib/receipt";

type AcceptResponse = {
  messages: { resultCode: string; message: { code: string; text: string }[] };
  opaqueData?: { dataDescriptor: string; dataValue: string };
};

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        data: {
          authData: { clientKey: string; apiLoginID: string };
          cardData: {
            cardNumber: string;
            month: string;
            year: string;
            cardCode: string;
            zip?: string;
            fullName?: string;
          };
        },
        handler: (response: AcceptResponse) => void,
      ) => void;
    };
  }
}

export default function CheckoutForm({
  clientKey,
  apiLoginId,
  scriptUrl,
}: {
  clientKey: string;
  apiLoginId: string;
  scriptUrl: string;
}) {
  const router = useRouter();
  const { lines, ready, clear } = useCart();
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [acceptReady, setAcceptReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const card = {
    number: useRef<HTMLInputElement>(null),
    month: useRef<HTMLInputElement>(null),
    year: useRef<HTMLInputElement>(null),
    code: useRef<HTMLInputElement>(null),
    zip: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (!ready) return;
    quoteCart(lines).then(setCart);
  }, [ready, lines]);

  // Accept.js is loaded from Authorize.net's own domain — that is the
  // point of it. If it fails to load, the form says so instead of
  // presenting a pay button that cannot work.
  useEffect(() => {
    if (window.Accept) {
      setAcceptReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => setAcceptReady(true);
    script.onerror = () =>
      setError(
        "We couldn't load the secure card form. Check your connection, or call the shop to pay by phone.",
      );
    document.body.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [scriptUrl]);

  if (!ready || !cart) return <div className="skeleton mt-10 h-64 w-full" />;

  if (cart.lines.length === 0) {
    return (
      <p className="mt-10 text-muted">
        Your cart is empty.{" "}
        <Link href="/inventory" className="underline hover:text-bone">
          Back to the inventory
        </Link>
        .
      </p>
    );
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!accepted) {
      setError("You have to accept the terms before we can take payment.");
      return;
    }
    if (!window.Accept) {
      setError("The secure card form isn't ready yet. Give it a second.");
      return;
    }

    const form = event.currentTarget;
    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? "";

    const customer = {
      firstName: value("firstName"),
      lastName: value("lastName"),
      email: value("email"),
      phone: value("phone"),
    };
    const shipping = cart.hasShipment
      ? {
          line1: value("shipLine1"),
          line2: value("shipLine2"),
          city: value("shipCity"),
          region: value("shipRegion"),
          postalCode: value("shipPostalCode"),
        }
      : null;

    start(() => {
      window.Accept!.dispatchData(
        {
          authData: { clientKey, apiLoginID: apiLoginId },
          cardData: {
            cardNumber: card.number.current?.value.replace(/\s/g, "") ?? "",
            month: card.month.current?.value ?? "",
            year: card.year.current?.value ?? "",
            cardCode: card.code.current?.value ?? "",
            zip: card.zip.current?.value ?? "",
            fullName: `${customer.firstName} ${customer.lastName}`.trim(),
          },
        },
        (response) => {
          if (response.messages.resultCode !== "Ok" || !response.opaqueData) {
            // Tokenization failures are almost always a mistyped card, so
            // the gateway's own text is more useful here than ours.
            setError(
              response.messages.message?.[0]?.text ??
                "We couldn't read that card. Check the number and try again.",
            );
            return;
          }

          void (async () => {
            const result = await submitCheckout({
              lines,
              customer,
              shipping,
              disclaimerAccepted: true,
              opaqueData: response.opaqueData!,
            });
            if (!result.ok) {
              setError(result.message);
              setFieldErrors(result.fieldErrors ?? {});
              return;
            }
            clear();
            router.push(
              receiptPath(result.orderNumber, result.token),
            );
          })();
        },
      );
    });
  };

  const err = (key: string) =>
    fieldErrors[key] ? (
      <p className="label mt-2 text-danger">{fieldErrors[key]}</p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="mt-10 lg:grid lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="max-w-xl">
        <section>
          <h2 className="label text-acid">Your details</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="firstName">First name</label>
              <input id="firstName" name="firstName" required autoComplete="given-name" className="field-input" />
              {err("customer.firstName")}
            </div>
            <div>
              <label className="field-label" htmlFor="lastName">Last name</label>
              <input id="lastName" name="lastName" required autoComplete="family-name" className="field-input" />
              {err("customer.lastName")}
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="field-input" />
              {err("customer.email")}
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="phone">Phone (optional)</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" className="field-input" />
            </div>
          </div>
        </section>

        {/* Shipping fields exist only when something in the cart ships.
            Asking a buyer collecting a pistol for a delivery address
            would imply we might post it to them. */}
        {cart.hasShipment && (
          <section className="mt-12">
            <h2 className="label text-acid">Shipping address</h2>
            <p className="mt-3 max-w-[60ch] text-sm text-muted">
              {SHIPPING_NOTICE}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="shipLine1">Street address</label>
                <input id="shipLine1" name="shipLine1" required autoComplete="address-line1" className="field-input" />
                {err("shipping.line1")}
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="shipLine2">Apartment, suite (optional)</label>
                <input id="shipLine2" name="shipLine2" autoComplete="address-line2" className="field-input" />
              </div>
              <div>
                <label className="field-label" htmlFor="shipCity">City</label>
                <input id="shipCity" name="shipCity" required autoComplete="address-level2" className="field-input" />
                {err("shipping.city")}
              </div>
              <div>
                <label className="field-label" htmlFor="shipRegion">State</label>
                <input id="shipRegion" name="shipRegion" required autoComplete="address-level1" maxLength={40} className="field-input" />
                {err("shipping.region")}
              </div>
              <div>
                <label className="field-label" htmlFor="shipPostalCode">ZIP</label>
                <input id="shipPostalCode" name="shipPostalCode" required autoComplete="postal-code" className="field-input" />
                {err("shipping.postalCode")}
              </div>
            </div>
          </section>
        )}

        {cart.hasPickup && (
          <section className="mt-12">
            <h2 className="label text-amber">Collecting at the shop</h2>
            <p className="field-well mt-4 max-w-[60ch] p-5 text-sm leading-relaxed text-amber">
              {PICKUP_NOTICE}
            </p>
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {cart.pickupLines.map((l) => (
                <li key={l.itemId}>{l.name}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12">
          <h2 className="label text-acid">Card</h2>
          <p className="mt-3 max-w-[60ch] text-sm text-muted">
            Your card goes straight to our processor. It never touches our
            servers.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <label className="field-label" htmlFor="cardNumber">Card number</label>
              <input
                id="cardNumber"
                ref={card.number}
                inputMode="numeric"
                autoComplete="cc-number"
                required
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="cardMonth">Month</label>
              <input id="cardMonth" ref={card.month} inputMode="numeric" placeholder="MM" maxLength={2} autoComplete="cc-exp-month" required className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="cardYear">Year</label>
              <input id="cardYear" ref={card.year} inputMode="numeric" placeholder="YYYY" maxLength={4} autoComplete="cc-exp-year" required className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="cardCode">CVV</label>
              <input id="cardCode" ref={card.code} inputMode="numeric" maxLength={4} autoComplete="cc-csc" required className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="cardZip">Billing ZIP</label>
              <input id="cardZip" ref={card.zip} inputMode="numeric" maxLength={10} autoComplete="billing postal-code" required className="field-input" />
            </div>
          </div>
        </section>

        {/* Placement 2 of 3, and the only one that gates anything. The
            checkbox is required by the form AND re-checked on the server,
            because a disabled button is a suggestion, not a control. */}
        <section className="mt-12 border-t hairline pt-8">
          <h2 className="label text-muted">Terms of this sale</h2>
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-muted">
            {FIREARM_DISCLAIMER}
          </p>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted">
            {REFUND_POLICY}
          </p>
          <label className="mt-6 flex max-w-[62ch] cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              required
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-acid)]"
            />
            <span className="text-sm leading-relaxed">
              I have read and accept the terms above, and I confirm these items
              are legal for me to possess where I live.
            </span>
          </label>
          {err("disclaimerAccepted")}
        </section>
      </div>

      <aside className="mt-14 lg:sticky lg:top-24 lg:mt-0 lg:self-start">
        <div className="border hairline p-6">
          <h2 className="label text-muted">Order</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {cart.lines.map((l) => (
              <li key={lineKey(l)} className="flex justify-between gap-4">
                <span className="min-w-0">
                  {l.name}
                  {l.size ? ` — ${l.size}` : ""}
                  {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                  <span
                    className={`label ml-2 ${
                      l.fulfillment === "pickup" ? "text-amber" : "text-muted"
                    }`}
                  >
                    {l.fulfillment === "pickup" ? "collect" : "ships"}
                  </span>
                </span>
                <span className="shrink-0">{formatUsd(l.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t hairline pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatUsd(cart.subtotalCents)}</dd>
            </div>
            {cart.shippingCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd>{formatUsd(cart.shippingCents)}</dd>
              </div>
            )}
            {cart.taxCents > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Tax</dt>
                <dd>{formatUsd(cart.taxCents)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t hairline pt-5">
            <span className="label">Total</span>
            <span className="text-xl font-extrabold tracking-[-0.02em]">
              {formatUsd(cart.totalCents)}
            </span>
          </div>

          {cart.entriesEarned > 0 && (
            <p className="mt-5 border-t hairline pt-5 text-sm text-acid">
              Earns {cart.entriesEarned}{" "}
              {cart.entriesEarned === 1 ? "entry" : "entries"}
              {cart.campaign ? ` in ${cart.campaign.title}` : ""}.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-5 border-l-2 border-danger pl-4 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!accepted || !acceptReady || pending}
            className="cta-primary control-go mt-7 w-full"
          >
            {pending
              ? "Processing…"
              : !acceptReady
                ? "Loading secure form…"
                : `Pay ${formatUsd(cart.totalCents)}`}
          </button>
          {!accepted && (
            <p className="label mt-3 text-center text-muted">
              Accept the terms to continue
            </p>
          )}
          <Link href="/cart" className="cta-secondary mt-3 w-full justify-center">
            Back to cart
          </Link>
        </div>
      </aside>
    </form>
  );
}
