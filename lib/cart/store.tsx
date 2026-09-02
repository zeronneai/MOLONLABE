"use client";

// The browser's half of the cart: ids and quantities in localStorage, and
// nothing else. No prices, no names, no totals — those are the server's,
// re-derived on every render of the cart and again at checkout. Tampering
// with this store can only change *what* someone tries to buy, never what
// they are charged for it.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MAX_QUANTITY, type CartLine, type FulfillmentType } from "./types";

const KEY = "mlf_cart";

type CartContextValue = {
  lines: CartLine[];
  /** False until localStorage has been read, so the UI can avoid flicker. */
  ready: boolean;
  count: number;
  add: (itemId: string, fulfillment: FulfillmentType) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything could be in here — another tab, an old build, a person with
    // devtools open. Only well-formed lines survive.
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const { itemId, quantity } = entry as Record<string, unknown>;
      if (typeof itemId !== "string" || !itemId) return [];
      const qty = Math.floor(Number(quantity));
      if (!Number.isFinite(qty) || qty < 1) return [];
      return [{ itemId, quantity: Math.min(qty, MAX_QUANTITY.ship) }];
    });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // Read after mount, never during render: the server has no localStorage,
  // so seeding state from it directly would hydrate mismatched markup.
  useEffect(() => {
    setLines(read());
    setReady(true);
  }, []);

  // Two tabs open is normal — somebody browsing inventory in one and the
  // cart in the other. Without this the second tab silently overwrites.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setLines(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode or a full quota. The cart still works for this page
      // view; it just will not survive a reload. Not worth an error the
      // buyer has to read.
    }
  }, []);

  const add = useCallback(
    (itemId: string, fulfillment: FulfillmentType) => {
      const max = MAX_QUANTITY[fulfillment];
      const current = read();
      const existing = current.find((l) => l.itemId === itemId);
      const next = existing
        ? current.map((l) =>
            l.itemId === itemId
              ? { ...l, quantity: Math.min(l.quantity + 1, max) }
              : l,
          )
        : [...current, { itemId, quantity: 1 }];
      persist(next);
    },
    [persist],
  );

  const setQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const qty = Math.floor(quantity);
      if (qty < 1) {
        persist(read().filter((l) => l.itemId !== itemId));
        return;
      }
      persist(
        read().map((l) =>
          l.itemId === itemId
            ? { ...l, quantity: Math.min(qty, MAX_QUANTITY.ship) }
            : l,
        ),
      );
    },
    [persist],
  );

  const remove = useCallback(
    (itemId: string) => persist(read().filter((l) => l.itemId !== itemId)),
    [persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
