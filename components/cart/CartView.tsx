"use client";

// The cart. Grouped by how each line is fulfilled, because that split is
// the thing a buyer most needs to understand before paying: some of this
// arrives in the post, and some of it means a drive to Montana Ave and a
// background check.
//
// Every figure here comes back from the server, with one exception made
// for speed: when a quantity changes, the line and the subtotal show the
// new figure at once (unit price times quantity, nothing to decide), and
// tax, shipping and the total are dimmed until the server's re-quote
// arrives a moment later. The server's figures are always what is paid.

import { dropPath } from "@/lib/games/paths";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import CartThumb from "@/components/cart/CartThumb";
import { useCart } from "@/lib/cart/store";
import { quoteCart } from "@/app/actions/cart";
import { formatUsd } from "@/lib/money";
import { PICKUP_NOTICE, SHIPPING_NOTICE } from "@/lib/legal";
import { lineKey, type PricedCart, type PricedLine } from "@/lib/cart/types";
import EmptyState from "@/components/ui/EmptyState";

export default function CartView() {
  const { lines, ready, setQuantity, remove } = useCart();
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [pending, start] = useTransition();

  // Only the newest quote is applied. Tapping + three times fires three
  // quotes, and an older one arriving last must not put a stale total
  // back on screen.
  const latest = useRef(0);
  const refresh = useCallback(() => {
    const mine = ++latest.current;
    start(async () => {
      const quote = await quoteCart(lines);
      if (mine === latest.current) setCart(quote);
    });
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
        action={{ href: "/shop", text: "Go to the shop" }}
      />
    );
  }

  // What the buyer just asked for, applied to the server's lines at once:
  // a removed line disappears, a changed quantity shows, bounded by what
  // the server said is available.
  const wanted = new Map(lines.map((l) => [lineKey(l), Math.floor(l.quantity)]));
  const current = (group: PricedLine[]) =>
    group
      .filter((l) => wanted.has(lineKey(l)))
      .map((l) => {
        const quantity = Math.max(1, Math.min(wanted.get(lineKey(l)) ?? l.quantity, l.maxQuantity));
        return { ...l, quantity, lineTotalCents: l.unitPriceCents * quantity };
      });
  const guideLines = current(cart.lines.filter((l) => l.gameId));
  const shipLines = current(cart.shipLines);
  const pickupLines = current(cart.pickupLines);
  const shown = [...guideLines, ...shipLines, ...pickupLines];
  const subtotalCents = shown.reduce((sum, l) => sum + l.lineTotalCents, 0);
  // The quote on screen no longer matches what is in the cart: a change
  // is on its way to the server.
  const stale =
    pending ||
    shown.length !== cart.lines.length ||
    shown.some((l) => l.quantity !== cart.lines.find((c) => lineKey(c) === lineKey(l))?.quantity);
  const guideCount = guideLines.reduce((n, l) => n + l.quantity, 0);

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
                <li key={r.key}>
                  <span className="text-bone">{r.name ?? "An item"}</span>:{" "}
                  {r.reason}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => cart.rejected.forEach((r) => remove(r.key))}
              className="control control-sm mt-4"
            >
              Clear these
            </button>
          </div>
        )}

        {guideLines.length > 0 && (
          <Group
            title="Guides"
            note="Each guide is one entry into the drawing. Guide numbers are assigned when you pay."
            tone="acid"
            lines={guideLines}
            onQuantity={setQuantity}
            onRemove={remove}
          />
        )}

        {shipLines.length > 0 && (
          <Group
            title="Ships to you"
            note={SHIPPING_NOTICE}
            tone="muted"
            lines={shipLines}
            onQuantity={setQuantity}
            onRemove={remove}
          />
        )}

        {pickupLines.length > 0 && (
          <Group
            title="Collect at the shop"
            note={PICKUP_NOTICE}
            tone="amber"
            lines={pickupLines}
            onQuantity={setQuantity}
            onRemove={remove}
          />
        )}
      </div>

      <aside className="mt-14 lg:sticky lg:top-24 lg:mt-0 lg:self-start">
        <div className="border hairline p-6">
          <h2 className="label text-muted">Order</h2>
          <dl className="mt-5 space-y-2 text-sm" aria-busy={stale} data-cart-totals={stale ? "updating" : "settled"}>
            <Row label="Subtotal" value={formatUsd(subtotalCents)} testId="subtotal" />
            <div className={stale ? "opacity-50 transition-opacity" : "transition-opacity"}>
              {cart.shippingCents > 0 && (
                <Row label="Shipping" value={formatUsd(cart.shippingCents)} />
              )}
              {cart.taxCents > 0 && (
                <Row label="Tax" value={formatUsd(cart.taxCents)} />
              )}
            </div>
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t hairline pt-5">
            <span className="label">Total</span>
            <span
              data-cart-total
              className={`text-xl font-extrabold tracking-[-0.02em] transition-opacity ${stale ? "opacity-50" : ""}`}
            >
              {formatUsd(cart.totalCents)}
            </span>
          </div>
          {stale && <p className="label mt-2 text-right text-muted">Updating…</p>}

          {/* Spots are the reason most of these carts exist, so the
              cart says what is about to happen to them rather than
              leaving it to the checkout. The terms are repeated at
              checkout as a blocking checkbox. */}
          {cart.spotGame && guideCount > 0 && (
            <div className="mt-5 border-t hairline pt-5">
              <p className="text-sm text-acid">
                {guideCount} {guideCount === 1 ? "guide" : "guides"} for the drop{" "}
                <Link href={dropPath(cart.spotGame.id)} className="font-extrabold underline" data-cart-drop-name>
                  {cart.spotGame.title}
                </Link>
                {cart.spotGame.pieceName && cart.spotGame.pieceName !== cart.spotGame.title
                  ? `, featuring the ${cart.spotGame.pieceName}`
                  : ""}
                .{" "}
                <span className="text-muted">
                  {cart.spotGame.remaining}{" "}
                  {cart.spotGame.remaining === 1 ? "guide" : "guides"} left of{" "}
                  {cart.spotGame.totalSpots}.
                </span>
              </p>
              <p className="label mt-3 text-muted">
                Guide numbers are assigned when you pay. Purchases are final.
              </p>
            </div>
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
          <Link href="/shop" className="cta-secondary mt-3 w-full justify-center">
            Keep looking
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted">{label}</dt>
      <dd data-cart-row={testId}>{value}</dd>
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
  tone: "muted" | "amber" | "acid";
  lines: PricedLine[];
  onQuantity: (key: string, q: number) => void;
  onRemove: (key: string) => void;
}) {
  const color = tone === "amber" ? "text-amber" : tone === "acid" ? "text-acid" : "text-muted";
  return (
    <section className="mb-12">
      <h2 className={`label ${color}`}>{title}</h2>
      <p className={`mt-3 max-w-[62ch] text-sm ${tone === "amber" ? "text-amber" : "text-muted"}`}>
        {note}
      </p>
      <ul className="mt-5 border-t hairline">
        {lines.map((line) => (
          <CartLineRow key={lineKey(line)} line={line} onQuantity={onQuantity} onRemove={onRemove} />
        ))}
      </ul>
    </section>
  );
}

/**
 * One line: a small square picture, then what it is, then the controls.
 * Laid out for a phone first: the picture and the price keep their width,
 * and the name wraps rather than pushing either off the screen.
 */
function CartLineRow({
  line,
  onQuantity,
  onRemove,
}: {
  line: PricedLine;
  onQuantity: (key: string, q: number) => void;
  onRemove: (key: string) => void;
}) {
  const key = lineKey(line);
  const guide = Boolean(line.gameId);
  const name = guide
    ? line.pieceName
      ? `Guide to the ${line.pieceName}`
      : "Guide"
    : line.name;
  // A guide line goes to its own drop's page, never to a page that picks.
  const href = guide && line.gameId ? dropPath(line.gameId) : `/inventory/${line.slug}`;
  // A single unit (a firearm to collect) is always exactly one.
  const fixed = line.maxQuantity <= 1 && line.fulfillment === "pickup";

  return (
    <li
      data-cart-line={key}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 border-b hairline py-4"
    >
      <CartThumb src={line.image} label={guide && line.pieceName ? line.pieceName : name} />
      <div className="min-w-0">
        <Link href={href} className="block font-extrabold leading-snug tracking-[-0.02em] hover:text-acid">
          {name}
        </Link>
        {guide && line.dropTitle && (
          <p className="mt-1 truncate text-sm text-muted" data-cart-drop>{line.dropTitle}</p>
        )}
        {line.size && <p className="label mt-1 text-acid" data-cart-size>Size {line.size}</p>}
        <p className="mt-1 text-sm text-muted">
          {formatUsd(line.unitPriceCents)} each
        </p>
      </div>
      <p className="font-extrabold tabular-nums tracking-[-0.02em]" data-cart-line-total>
        {formatUsd(line.lineTotalCents)}
      </p>

      <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-3">
        {fixed ? (
          <span className="label text-muted" data-cart-qty-fixed>Qty 1</span>
        ) : (
          <div role="group" aria-label={`Quantity of ${name}`} className="inline-flex items-center border hairline">
            <button
              type="button"
              aria-label={`One fewer ${name}`}
              disabled={line.quantity <= 1}
              onClick={() => onQuantity(key, line.quantity - 1)}
              className="flex h-11 w-11 items-center justify-center text-lg hover:text-acid disabled:opacity-35"
              data-cart-minus
            >
              −
            </button>
            <span aria-live="polite" className="w-10 text-center tabular-nums" data-cart-qty>
              {line.quantity}
            </span>
            <button
              type="button"
              aria-label={`One more ${name}`}
              disabled={line.quantity >= line.maxQuantity}
              onClick={() => onQuantity(key, line.quantity + 1)}
              className="flex h-11 w-11 items-center justify-center text-lg hover:text-acid disabled:opacity-35"
              data-cart-plus
            >
              +
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => onRemove(key)}
          className="label flex h-11 items-center px-2 text-muted hover:text-danger"
          data-cart-remove
        >
          Remove
        </button>
      </div>
    </li>
  );
}
