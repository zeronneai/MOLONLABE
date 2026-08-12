import { getSessionSupabase } from "@/lib/supabase/session";
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

      <div className="mt-6 flex flex-wrap gap-x-6">
        {["", "new", "contacted", "closed"].map((s) => (
          <a
            key={s || "all"}
            href={`/admin/inquiries${s ? `?status=${s}` : ""}`}
            className="filter-tap"
            aria-pressed={status === s}
          >
            <span className="filter-label">{s || "All"}</span>
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
          <p className="label py-10 text-muted">Nothing here.</p>
        )}
      </div>
    </div>
  );
}
