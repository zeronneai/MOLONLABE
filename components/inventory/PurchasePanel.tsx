"use client";

// Buy controls on the product page: price, what it earns, how it is
// collected, and the attorney's disclaimer — the first of its three
// required placements.
//
// The disclaimer sits above the button, not below it and not behind a
// disclosure. It is a condition of the purchase, so it goes where it is
// read before the decision rather than after it.

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart/store";
import { formatUsd } from "@/lib/money";
import { FIREARM_DISCLAIMER, PICKUP_NOTICE, REFUND_POLICY, ENTRY_CLAIM} from "@/lib/legal";
import type { FulfillmentType, VariantOption } from "@/lib/cart/types";

export default function PurchasePanel({
  itemId,
  priceCents,
  priceDisplay,
  fulfillment,
  available,
  entriesEarned,
  campaignTitle,
  variants,
  showDisclaimer,
}: {
  itemId: string;
  /** Null when the item is not sold online. */
  priceCents: number | null;
  priceDisplay: string | null;
  fulfillment: FulfillmentType;
  available: boolean;
  entriesEarned: number;
  campaignTitle: string | null;
  /** Empty for anything sold as a single unit. */
  variants: VariantOption[];
  /**
   * Firearms and ammunition only. Decided by the caller from the item's
   * category so this component never has to know the taxonomy.
   */
  showDisclaimer: boolean;
}) {
  const { add, lines } = useCart();
  const [added, setAdded] = useState(false);
  const sized = variants.length > 0;
  const anyInStock = variants.some((v) => v.inStock);
  // No pre-selection. Auto-picking the first size in stock would let
  // somebody add a medium while looking at a page they thought was large.
  const [size, setSize] = useState<string | null>(null);
  const inCart = lines.some(
    (l) => l.itemId === itemId && (!sized || l.variantId === size),
  );

  // Not sold online: the page keeps the old behaviour exactly — the
  // display price and the inquiry CTAs below it. Nothing about checkout
  // appears at all.
  if (priceCents == null) {
    return (
      <p className="mt-8 text-2xl font-extrabold tracking-[-0.02em]">
        {(priceDisplay ?? "Call for price").toUpperCase()}
      </p>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-2xl font-extrabold tracking-[-0.02em]">
        {formatUsd(priceCents)}
      </p>

      {entriesEarned > 0 && (
        <p className="mt-3 text-sm text-acid">
          Earns {entriesEarned} {entriesEarned === 1 ? "entry" : "entries"}
          {campaignTitle ? ` in ${campaignTitle}` : ""}.{" "}
          <Link href="/featured" className="underline hover:text-bone">
            {ENTRY_CLAIM.link}
          </Link>
          .
        </p>
      )}

      {/* Sizes, when there are any. Sold-out ones stay on screen and
          disabled: seeing that the large has gone is information, and
          removing it just makes people wonder if it ever existed. */}
      {sized && (
        <fieldset className="mt-6">
          <legend className="label text-muted">Size</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                disabled={!variant.inStock}
                aria-pressed={size === variant.id}
                onClick={() => setSize(variant.id)}
                className="control control-sm tone-acid"
              >
                {variant.size}
                {!variant.inStock && (
                  <span className="ml-2 text-danger">Sold out</span>
                )}
              </button>
            ))}
          </div>
          {!anyInStock && (
            <p className="mt-3 text-sm text-danger">
              Every size has gone. Call the shop and we&apos;ll tell you when
              it&apos;s back.
            </p>
          )}
        </fieldset>
      )}

      {/* Which route this item takes, stated before the button rather
          than discovered at checkout. */}
      <p className="mt-4 text-sm text-muted">
        {fulfillment === "pickup"
          ? "Collected in person at the shop."
          : "Ships to you."}
      </p>

      {fulfillment === "pickup" && (
        <p className="field-well mt-4 max-w-[60ch] p-4 text-sm text-amber">
          {PICKUP_NOTICE}
        </p>
      )}

      {/* Placement 1 of 3, and the only one that is conditional. Verbatim,
          never abridged, never behind a "read more" — but only where it
          applies. The refund line is on everything, because it is. */}
      <div className="mt-6 max-w-[62ch] border-t hairline pt-5">
        <p className="label text-muted">Before you buy</p>
        {showDisclaimer && (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {FIREARM_DISCLAIMER}
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {REFUND_POLICY}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!available || (sized && (!anyInStock || !size))}
          onClick={() => {
            add(itemId, fulfillment, sized ? size : null);
            setAdded(true);
          }}
          className="cta-primary control-go"
        >
          {!available
            ? "Not available"
            : sized && !anyInStock
              ? "Sold out"
              : sized && !size
                ? "Pick a size"
                : inCart
                  ? "In your cart"
                  : "Add to cart"}
        </button>
        {(added || inCart) && (
          <Link href="/cart" className="cta-secondary">
            Go to cart
          </Link>
        )}
      </div>
    </div>
  );
}
