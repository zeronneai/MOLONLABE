import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { OwnerOnlyNote } from "@/components/admin/Role";
import { getStaff } from "@/lib/admin/staff";
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
    case "photos":
      return `changed the photos on ${label} (${plain(row.before_value)} before, ${plain(row.after_value)} now)`;
    case "stock":
      return `changed sizes or stock on ${label}: ${stockChange(row.before_value, row.after_value)}`;
    case "alerts":
      return `changed who gets ${row.field === "routine" ? "routine" : "urgent"} alerts to ${plain(row.after_value) === "nothing" ? "the script's default" : plain(row.after_value)}`;
    default:
      if (row.field === "details") return `edited ${label}: ${plain(row.after_value)}`;
      if (row.field === "order") return `${plain(row.after_value)} ${label} in the list`;
      if (row.field === "duplicated from") return `added ${label} as a copy of ${plain(row.after_value)}`;
      return row.field
        ? `changed ${row.field} on ${label} from ${plain(row.before_value)} to ${plain(row.after_value)}`
        : `edited ${label}`;
  }
}

/** "M 4 → 2, XL added (3), S removed" from two size→count maps. */
function stockChange(before: unknown, after: unknown): string {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, number>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, number>;
  const parts: string[] = [];
  for (const size of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (!(size in a)) parts.push(`${size} removed`);
    else if (!(size in b)) parts.push(`${size} added (${a[size]})`);
    else if (b[size] !== a[size]) parts.push(`${size} ${b[size]} → ${a[size]}`);
  }
  return parts.join(", ") || "reordered";
}

/** Red for anything destructive, amber for money and live switches. */
function tone(action: string): string {
  if (action === "delete" || action === "archive") return "text-danger";
  if (action === "price" || action === "offer" || action === "commerce")
    return "text-amber";
  return "text-muted";
}

/**
 * The log, owner only, filterable by person.
 *
 * For a manager this page says it is the owner's rather than showing an
 * empty list: row level security answers a manager's read of this table
 * with no rows, and "Nothing recorded yet" would be a lie he might
 * believe.
 */
export default async function AdminActivity({
  searchParams,
}: {
  searchParams: Promise<{ who?: string }>;
}) {
  const me = await getStaff();
  if (!me.ok) return null;
  const { sb, role } = me.staff;

  if (role !== "owner") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="display text-2xl">ACTIVITY</h1>
        <p className="mt-4 max-w-[60ch] text-sm text-muted">
          Every change made in this admin, with who made it.
        </p>
        <OwnerOnlyNote />
      </div>
    );
  }

  const { who } = await searchParams;
  const person = typeof who === "string" && /^[0-9a-f-]{36}$/i.test(who) ? who : null;

  let query = sb
    .from("admin_activity")
    .select("*")
    .order("at", { ascending: false })
    .limit(200);
  if (person) query = query.eq("actor_id", person);

  const [{ data: rows }, { data: team }] = await Promise.all([
    query,
    sb.from("staff").select("user_id, display_name, role").order("role").order("display_name"),
  ]);
  const people = team ?? [];
  const chosen = people.find((p) => p.user_id === person);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">ACTIVITY</h1>
      <p className="mt-4 max-w-[60ch] text-sm text-muted">
        Who changed what, and what it was before. The last 200 changes
        {chosen ? ` by ${chosen.display_name}` : ""}.
      </p>

      {people.length > 0 && (
        <nav aria-label="Filter by person" className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/admin/activity"
            aria-current={!person ? "page" : undefined}
            className={`control control-sm ${!person ? "tone-acid" : ""}`}
          >
            Everyone
          </Link>
          {people.map((p) => (
            <Link
              key={p.user_id}
              href={`/admin/activity?who=${p.user_id}`}
              aria-current={person === p.user_id ? "page" : undefined}
              className={`control control-sm ${person === p.user_id ? "tone-acid" : ""}`}
            >
              {p.display_name}
              <span className="ml-2 text-muted">{p.role === "owner" ? "Owner" : "Manager"}</span>
            </Link>
          ))}
        </nav>
      )}

      {(rows ?? []).length === 0 ? (
        <div className="mt-10">
          <EmptyState
            label="Activity"
            headline={chosen ? `Nothing by ${chosen.display_name} yet` : "Nothing recorded yet"}
            body="Every change made in this admin lands here: items, photos, sizes and stock, games, draws, inquiries, and settings."
          />
        </div>
      ) : (
        <div className="mt-10 border-t hairline">
          {(rows ?? []).map((row) => (
            <article key={row.id} data-activity className="border-b hairline py-4">
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
