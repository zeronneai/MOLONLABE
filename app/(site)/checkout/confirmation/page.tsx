import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceSupabase } from "@/lib/supabase/service";
import { formatUsd } from "@/lib/money";
import {
  FIREARM_DISCLAIMER,
  PICKUP_NOTICE,
  REFUND_POLICY,
  SHIPPING_NOTICE,
} from "@/lib/legal";
import {
  DIRECTIONS_URL,
  SHOP_ADDRESS,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_HREF,
} from "@/lib/brand";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The buyer's receipt, with no account and no session behind it.
 *
 * Orders are unreadable with the public key — there is no anon RLS policy
 * on the table at all — so this page reads with the service role and
 * requires both the order number and the random token issued at
 * checkout. Guessing an order number gets you a 404; the token is the
 * actual credential.
 */
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; t?: string }>;
}) {
  const { order: orderNumber, t: token } = await searchParams;
  if (!orderNumber || !token) notFound();

  const sb = getServiceSupabase();
  if (!sb) notFound();

  const { data: order } = await sb
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .eq("confirmation_token", token)
    .maybeSingle();
  if (!order) notFound();

  const { data: lines } = await sb
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  const all = lines ?? [];
  const shipLines = all.filter((l) => l.fulfillment_type === "ship");
  const pickupLines = all.filter((l) => l.fulfillment_type === "pickup");

  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Order {order.order_number}</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,4.5rem)]">
        THANKS,
        <br />
        {order.first_name.toUpperCase()}.
      </h1>
      <p className="mt-6 max-w-[60ch] text-muted">
        {order.confirmation_sent_at
          ? `A copy is on its way to ${order.email}.`
          : `We couldn't send the email copy — write this order number down, and call the shop if you need it resent.`}
      </p>

      <div className="mt-14 max-w-2xl">
        {shipLines.length > 0 && (
          <section className="mb-12">
            <h2 className="label text-muted">Shipping to you</h2>
            <p className="mt-3 max-w-[60ch] text-sm text-muted">
              {SHIPPING_NOTICE}
            </p>
            <LineList lines={shipLines} />
            {order.ship_line1 && (
              <address className="mt-5 not-italic text-sm text-muted">
                {order.ship_name}
                <br />
                {order.ship_line1}
                <br />
                {order.ship_line2 && (
                  <>
                    {order.ship_line2}
                    <br />
                  </>
                )}
                {order.ship_city}, {order.ship_region} {order.ship_postal_code}
              </address>
            )}
          </section>
        )}

        {pickupLines.length > 0 && (
          <section className="mb-12">
            <h2 className="label text-amber">Collect at the shop</h2>
            <LineList lines={pickupLines} />
            <div className="field-well mt-5 p-5">
              <p className="max-w-[60ch] text-sm leading-relaxed text-amber">
                {PICKUP_NOTICE}
              </p>
              <p className="mt-4 text-sm text-muted">
                {SHOP_ADDRESS.street}
                <br />
                {SHOP_ADDRESS.city}, {SHOP_ADDRESS.region}{" "}
                {SHOP_ADDRESS.postalCode}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="control control-sm"
                >
                  Directions
                </a>
                <a href={SHOP_PHONE_HREF} className="control control-sm">
                  Call {SHOP_PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </section>
        )}

        <dl className="space-y-2 border-t hairline pt-6 text-sm">
          <Row label="Subtotal" value={formatUsd(order.subtotal_cents)} />
          {order.shipping_cents > 0 && (
            <Row label="Shipping" value={formatUsd(order.shipping_cents)} />
          )}
          {order.tax_cents > 0 && (
            <Row label="Tax" value={formatUsd(order.tax_cents)} />
          )}
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t hairline pt-4">
          <span className="label">Total</span>
          <span className="text-xl font-extrabold tracking-[-0.02em]">
            {formatUsd(order.total_cents)}
          </span>
        </div>
        {order.card_last4 && (
          <p className="mt-3 text-sm text-muted">
            Paid with {order.card_brand ?? "card"} ending {order.card_last4}.
          </p>
        )}

        {order.entries_awarded > 0 && (
          <p className="mt-8 border-l-2 border-acid pl-5 text-sm text-acid">
            This order earned {order.entries_awarded}{" "}
            {order.entries_awarded === 1 ? "entry" : "entries"}.{" "}
            <Link href="/featured" className="underline hover:text-bone">
              No purchase is necessary to enter
            </Link>
            .
          </p>
        )}

        {/* Placement 3 of 3. Shown from the order's own stored copy, not
            from the constant — this is what the buyer accepted, and it
            stays true even after the wording changes. */}
        <div className="mt-14 border-t hairline pt-8">
          <h2 className="label text-muted">Terms you accepted</h2>
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-muted">
            {order.disclaimer_text || FIREARM_DISCLAIMER}
          </p>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted">
            {order.refund_policy_text || REFUND_POLICY}
          </p>
          <p className="label mt-4 text-muted">
            Accepted{" "}
            {new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Denver",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(order.disclaimer_accepted_at))}{" "}
            MT
          </p>
        </div>

        <Link href="/inventory" className="cta-secondary mt-12">
          Back to the inventory
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function LineList({
  lines,
}: {
  lines: {
    id: string;
    name: string;
    size: string | null;
    quantity: number;
    line_total_cents: number;
  }[];
}) {
  return (
    <ul className="mt-5 border-t hairline">
      {lines.map((l) => (
        <li key={l.id} className="flex justify-between gap-4 border-b hairline py-4">
          <span className="font-extrabold tracking-[-0.02em]">
            {l.name}
            {l.size && (
              <span className="ml-2 font-normal text-muted">{l.size}</span>
            )}
            {l.quantity > 1 && (
              <span className="ml-2 font-normal text-muted">× {l.quantity}</span>
            )}
          </span>
          <span className="shrink-0">{formatUsd(l.line_total_cents)}</span>
        </li>
      ))}
    </ul>
  );
}
