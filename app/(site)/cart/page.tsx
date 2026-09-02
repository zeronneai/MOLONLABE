import type { Metadata } from "next";
import CartView from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Cart",
  // A cart is per-person and has nothing to index.
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Your cart</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,4.5rem)]">
        WHAT YOU&apos;RE
        <br />
        TAKING HOME.
      </h1>
      <CartView />
    </div>
  );
}
