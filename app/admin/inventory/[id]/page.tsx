import { notFound } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";
import ItemForm from "@/components/admin/ItemForm";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await getSessionSupabase();
  if (!sb) return null;
  const { data: item } = await sb.from("items").select("*").eq("id", id).maybeSingle();
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">EDIT ITEM</h1>
      <div className="mt-8">
        <ItemForm item={item} />
      </div>
    </div>
  );
}
