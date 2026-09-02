"use client";

// The cart. Grouped by how each line is fulfilled, because that split is
// the thing a buyer most needs to understand before paying: some of this
// arrives in the post, and some of it means a drive to Montana Ave and a
// background check.
//
// Every figure here comes back from the server. The component holds no
// pricing logic at all.

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart/store";
import { quoteCart } from "@/app/actions/cart";
import { formatUsd } from "@/lib/money";
import { PICKUP_NOTICE, SHIPPING_NOTICE } from "@/lib/legal";
import type { PricedCart, PricedLine } from "@/lib/cart/types";
import EmptyState from "@/components/ui/EmptyState";

export default function CartView() {
  const { lines, ready, setQuantity, remove } = useCart();
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(() => {
    start(async () => setCart(await quoteCart(lines)));
  }, [lines]);

  useEffect(() => {
    if (!ready) return;
    refresh();
  }, [ready, refresh]);

  if (!ready || (!cart && pending)) {
    return <div className="skeleton mt-10 h-40 w-full" />;
  }

  if (!cart || (cart.lines.length === 0 && cart.rejected.length === 0)) {
    return (
      <EmptyState
        label="Your cart"
        headline="Nothing in the cart"
        body="Everything on hand is in the case. Have a look and come back."
        action={{ href: "/inventory", text: "View inventory" }}
      />
    );
  }

  return (
    <div className="mt-10 lg:grid lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div>
        {/* Lines that vanished under the buyer. Stated plainly rather than
            silently dropped — a total that changed without explanation is
            how people stop trusting a checkout. */}
        {cart.rejected.length > 0 && (
          <div className="mb-10 border-l-2 border-danger bg-surface p-5">
            <p className="label text-danger">Removed from your cart</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {cart.rejected.map((r) => (
                <li key={r.itemId}>
                  <span className="text-bone">{r.name ?? "An item"}</span> —{" "}
                  {r.reason}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => cart.rejected.forEach((r) => remove(r.itemId))}
              className="control control-sm mt-4"
            >
              Clear these
            </button>
          </div>
        )}

        {cart.shipLines.length > 0 && (
          <Group
            title="Ships to you"
            note={SHIPPING_NOTICE}
            tone="muted"
            lines={cart.shipLines}
            onQuantity={setQuantity}
            onRemove={remove}
          />
        )}

        {cart.pickupLines.length > 0 && (
          <Group
            title="Collect at the shop"
            note={PICKUP_NOTICE}
            tone="amber"
            lines={cart.pickupLines}
            onQuantity={setQuantity}
            onRemove={remove}
          />
        )}
      </div>

      <aside className="mt-14 lg:sticky lg:top-24 lg:mt-0 lg:self-start">
        <div className="border hairline p-6">
          <h2 className="label text-muted">Order</h2>
          <dl className="mt-5 space-y-2 text-sm">
            <Row label="Subtotal" value={formatUsd(cart.subtotalCents)} />
            {cart.shippingCents > 0 && (
              <Row label="Shipping" value={formatUsd(cart.shippingCents)} />
            )}
            {cart.taxCents > 0 && (
              <Row label="Tax" value={formatUsd(cart.taxCents)} />
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
              This order earns {cart.entriesEarned}{" "}
              {cart.entriesEarned === 1 ? "entry" : "entries"}
              {cart.campaign ? ` in ${cart.campaign.title}` : ""}.
              <br />
              <Link href="/featured" className="text-muted underline hover:text-bone">
                No purchase necessary to enter
              </Link>
            </p>
          )}

          <Link
            href="/checkout"
            aria-disabled={cart.lines.length === 0}
            className={`cta-primary control-go mt-7 w-full ${
              cart.lines.length === 0 ? "pointer-events-none opacity-45" : ""
            }`}
          >
            Checkout
          </Link>
          <Link href="/inventory" className="cta-secondary mt-3 w-full justify-center">
            Keep looking
          </Link>
        </div>
      </aside>
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

function Group({
  title,
  note,
  tone,
  lines,
  onQuantity,
  onRemove,
}: {
  title: string;
  note: string;
  tone: "muted" | "amber";
  lines: PricedLine[];
  onQuantity: (id: string, q: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="mb-12">
      <h2 className={`label ${tone === "amber" ? "text-amber" : "text-muted"}`}>
        {title}
      </h2>
      <p
        className={`mt-3 max-w-[62ch] text-sm ${
          tone === "amber" ? "text-amber" : "text-muted"
        }`}
      >
        {note}
      </p>
      <ul className="mt-6 border-t hairline">
        {lines.map((line) => (
          <li
            key={line.itemId}
            className="flex items-start gap-5 border-b hairline py-5"
          >
            <div className="relative h-20 w-20 shrink-0 bg-surface">
              {line.image && (
                <Image
                  src={line.image}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/inventory/${line.slug}`}
                className="font-extrabold tracking-[-0.02em] hover:text-acid"
              >
                {line.name}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {formatUsd(line.unitPriceCents)}
                {line.quantity > 1 ? ` each` : ""}
              </p>
              <div className="mt-3 flex items-center gap-3">
                {/* Firearms are single units, so there is nothing to
                    choose — showing a stepper stuck at one would just
                    invite people to try. */}
                {line.fulfillment === "ship" ? (
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <span className="sr-only">Quantity for {line.name}</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={line.quantity}
                      onChange={(e) =>
                        onQuantity(line.itemId, Number(e.target.value))
                      }
                      className="field-input !h-11 w-20"
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(line.itemId)}
                  className="control control-sm control-danger"
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="shrink-0 font-extrabold tracking-[-0.02em]">
              {formatUsd(line.lineTotalCents)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
