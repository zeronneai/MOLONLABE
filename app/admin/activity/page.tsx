import { getSessionSupabase } from "@/lib/supabase/session";
import EmptyState from "@/components/ui/EmptyState";
import { formatUsd } from "@/lib/money";
import type { ActivityRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const stamp = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

/**
 * A change, in a sentence.
 *
 * Prices are shown as money rather than as the integer cents they are
 * stored in — "1299 → 1499" is a puzzle, "$12.99 → $14.99" is a fact.
 */
function describe(row: ActivityRow): string {
  const label = row.entity_label ?? "a record";
  const money = (v: unknown) =>
    typeof v === "number" ? formatUsd(v) : v == null ? "nothing" : String(v);
  const plain = (v: unknown) =>
    v === null || v === undefined || v === "" ? "nothing" : String(v);

  switch (row.action) {
    case "create":
      return `added ${label}`;
    case "delete":
      return `deleted ${label}`;
    case "archive":
      return `archived ${label}`;
    case "restore":
      return `restored ${label} to ${plain(row.after_value)}`;
    case "status":
      return `changed ${label} from ${plain(row.before_value)} to ${plain(row.after_value)}`;
    case "price":
      return `repriced ${label} from ${money(row.before_value)} to ${money(row.after_value)}`;
    case "featured":
      return row.after_value === true
        ? `put ${label} in the featured slot`
        : `took ${label} out of the featured slot`;
    case "offer":
      if (row.field === "enabled")
        return row.after_value === true
          ? "switched the game discount ON"
          : "switched the game discount OFF";
      return `changed the discount code from ${plain(row.before_value)} to ${plain(row.after_value)}`;
    case "commerce":
      if (row.field === "tax_rate_bps")
        return `set sales tax to ${Number(row.after_value) / 100}% (was ${Number(row.before_value ?? 0) / 100}%)`;
      return `set ${row.field === "shipping_oversize_cents" ? "oversize" : "standard"} postage to ${money(row.after_value)} (was ${money(row.before_value)})`;
    case "difficulty":
      return `retuned the game (${row.field})`;
    case "draw":
      return `drew the winner for ${label}`;
    default:
      return row.field
        ? `changed ${row.field} on ${label} from ${plain(row.before_value)} to ${plain(row.after_value)}`
        : `edited ${label}`;
  }
}

/** Red for anything destructive, amber for money and live switches. */
function tone(action: string): string {
  if (action === "delete" || action === "archive") return "text-danger";
  if (action === "price" || action === "offer" || action === "commerce")
    return "text-amber";
  return "text-muted";
}

export default async function AdminActivity() {
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const { data: rows } = await sb
    .from("admin_activity")
    .select("*")
    .order("at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">ACTIVITY</h1>
      <p className="mt-4 max-w-[60ch] text-sm text-muted">
        Who changed what, and what it was before. The last 200 changes.
      </p>

      {(rows ?? []).length === 0 ? (
        <div className="mt-10">
          <EmptyState
            label="Activity"
            headline="Nothing recorded yet"
            body="Archiving, deleting, repricing, changing a status and switching the game discount all land here."
          />
        </div>
      ) : (
        <div className="mt-10 border-t hairline">
          {(rows ?? []).map((row) => (
            <article key={row.id} className="border-b hairline py-4">
              <p className="text-sm">
                <span className="font-extrabold tracking-[-0.02em]">
                  {row.actor_name}
                </span>{" "}
                <span className={tone(row.action)}>{describe(row)}</span>
              </p>
              <p className="label mt-1 text-muted">{stamp(row.at)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
