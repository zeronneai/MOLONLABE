import type { Metadata } from "next";
import Link from "next/link";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { getPaymentProvider } from "@/lib/payments";
import { SHOP_PHONE_DISPLAY, SHOP_PHONE_HREF } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

// Reads the gateway configuration per request, so credentials landing in
// the environment take effect without a rebuild.
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  const provider = getPaymentProvider();
  const config = provider.clientConfig();

  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Checkout</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,4.5rem)]">
        FINISH UP.
      </h1>

      {config ? (
        // The public key and login id are public by design — they are what
        // the browser needs to tokenize a card, and they can do nothing
        // else. The transaction key never leaves the server.
        <CheckoutForm
          clientKey={config.clientKey}
          apiLoginId={config.apiLoginId}
          scriptUrl={config.scriptUrl}
        />
      ) : (
        <div className="mt-10 max-w-xl">
          <p className="text-muted">
            Card payments aren&apos;t switched on yet. Call the shop and
            we&apos;ll take the order over the phone.
          </p>
          <a href={SHOP_PHONE_HREF} className="cta-primary control-go mt-8">
            Call {SHOP_PHONE_DISPLAY}
          </a>
          <p className="mt-6">
            <Link href="/cart" className="cta-secondary">
              Back to cart
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
