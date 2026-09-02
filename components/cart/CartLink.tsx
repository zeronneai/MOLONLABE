"use client";

// Cart entry point in the header. Renders nothing at all until the cart
// has something in it — an always-visible empty cart on a shop that sells
// four things is chrome for its own sake, and it would sit next to the
// phone number competing with the call CTA that actually converts here.

import Link from "next/link";
import { useCart } from "@/lib/cart/store";

export default function CartLink({ onNavigate }: { onNavigate?: () => void }) {
  const { count, ready } = useCart();
  if (!ready || count === 0) return null;

  return (
    <Link
      href="/cart"
      onClick={onNavigate}
      className="control control-sm"
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      Cart
      <span
        aria-hidden="true"
        className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[2px] bg-acid px-1 text-[11px] font-extrabold text-ink"
      >
        {count}
      </span>
    </Link>
  );
}
