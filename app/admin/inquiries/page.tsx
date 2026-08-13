import { getSessionSupabase } from "@/lib/supabase/session";
import EmptyState from "@/components/ui/EmptyState";
import InquiryCard from "@/components/admin/InquiryCard";

export const dynamic = "force-dynamic";

export default async function AdminInquiries({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "" } = await searchParams;
  const sb = await getSessionSupabase();
  if (!sb) return null;

  let query = sb.from("inquiries").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const [{ data: inquiries }, { data: items }] = await Promise.all([
    query,
    sb.from("items").select("id, name"),
  ]);
  const itemName = new Map((items ?? []).map((i) => [i.id, i.name]));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">INQUIRIES</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {["", "new", "contacted", "closed"].map((s) => (
          <a
            key={s || "all"}
            href={`/admin/inquiries${s ? `?status=${s}` : ""}`}
            className="control control-sm tone-acid"
            aria-pressed={status === s}
          >
            {s || "All"}
          </a>
        ))}
      </div>

      <div className="mt-6 border-t hairline">
        {(inquiries ?? []).map((inquiry) => (
          <InquiryCard
            key={inquiry.id}
            inquiry={inquiry}
            itemName={inquiry.item_id ? itemName.get(inquiry.item_id) : undefined}
          />
        ))}
        {(inquiries ?? []).length === 0 && (
          <EmptyState
            label={status ? "None here" : "Queue clear"}
            headline={status ? "NOTHING WITH THAT STATUS." : "QUEUE'S CLEAR."}
            body={
              status
                ? "Switch filters to see the rest."
                : "Nobody's waiting on you. New inquiries land here and get flagged until you've answered them."
            }
          />
        )}
      </div>
    </div>
  );
}
