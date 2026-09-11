import Link from "next/link";
import { getSessionSupabase } from "@/lib/supabase/session";
import EmptyState from "@/components/ui/EmptyState";
import { formatUsd } from "@/lib/money";

export const dynamic = "force-dynamic";

const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export default async function AdminOrders() {
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const { data: orders } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = (orders ?? []).map((o) => o.id);
  const { data: lines } = ids.length
    ? await sb.from("order_items").select("*").in("order_id", ids)
    : { data: [] };

  const byOrder = new Map<string, typeof lines>();
  for (const line of lines ?? []) {
    byOrder.set(line.order_id, [...(byOrder.get(line.order_id) ?? []), line]);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">ORDERS</h1>

      {(orders ?? []).length === 0 ? (
        <div className="mt-8">
          <EmptyState
            label="Orders"
            headline="No orders yet"
            body="Completed purchases land here, with what ships, what's collected, and when the buyer accepted the terms."
          />
        </div>
      ) : (
        <div className="mt-8 border-t hairline">
          {(orders ?? []).map((order) => {
            const orderLines = byOrder.get(order.id) ?? [];
            const ship = orderLines.filter((l) => l.fulfillment_type === "ship");
            const pickup = orderLines.filter(
              (l) => l.fulfillment_type === "pickup",
            );
            return (
              <article key={order.id} className="border-b hairline py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-extrabold tracking-[-0.02em]">
                    {order.order_number}
                    <span className="ml-3 font-normal text-muted">
                      {order.first_name} {order.last_name}
                    </span>
                  </p>
                  <p className="shrink-0 font-extrabold tracking-[-0.02em]">
                    {formatUsd(order.total_cents)}
                  </p>
                </div>

                <p className="mt-1 text-sm text-muted">
                  {order.email}
                  {order.phone ? ` · ${order.phone}` : ""}
                </p>
                <p className="label mt-2 text-muted">
                  {stamp(order.created_at)} · {order.status}
                  {order.card_last4
                    ? ` · ${order.card_brand ?? "card"} ${order.card_last4}`
                    : ""}
                </p>

                {pickup.length > 0 && (
                  <div className="mt-3">
                    <p className="label text-amber">Collect in store</p>
                    <ul className="mt-1 text-sm">
                      {pickup.map((l) => (
                        <li key={l.id}>
                          {l.name}
                          {l.size ? (
                            <span className="text-acid"> · {l.size}</span>
                          ) : null}
                          {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ship.length > 0 && (
                  <div className="mt-3">
                    <p className="label text-muted">Ships</p>
                    <ul className="mt-1 text-sm">
                      {ship.map((l) => (
                        <li key={l.id}>
                          {l.name}
                          {l.size ? (
                            <span className="text-acid"> · {l.size}</span>
                          ) : null}
                          {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                        </li>
                      ))}
                    </ul>
                    {order.ship_line1 && (
                      <address className="mt-2 not-italic text-sm text-muted">
                        {order.ship_line1}
                        {order.ship_line2 ? `, ${order.ship_line2}` : ""}
                        <br />
                        {order.ship_city}, {order.ship_region}{" "}
                        {order.ship_postal_code}
                      </address>
                    )}
                  </div>
                )}

                {/* The acceptance record. Surfaced on every row rather than
                    buried, because it is the thing the client would need
                    to produce if a sale were ever questioned. */}
                <p className="label mt-3 text-muted">
                  Terms accepted {stamp(order.disclaimer_accepted_at)}
                  {order.confirmation_sent_at ? "" : " · email NOT sent"}
                </p>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-10">
        <Link href="/admin" className="control control-sm">
          Back
        </Link>
      </p>
    </div>
  );
}
