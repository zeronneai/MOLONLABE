import { notFound } from "next/navigation";
import { getSessionSupabase } from "@/lib/supabase/session";
import { countItemReferences } from "@/lib/db/itemRefs";
import ItemForm from "@/components/admin/ItemForm";
import DeleteItem from "@/components/admin/DeleteItem";

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

  const refs = await countItemReferences(sb, id);

  // Sizes, if this item has any. Ordered the way the owner entered them.
  const { data: variants } = await sb
    .from("item_variants")
    .select("id, size, stock")
    .eq("item_id", id)
    .order("sort_order", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">EDIT ITEM</h1>
      <div className="mt-8">
        <ItemForm item={item} variants={variants ?? []} />
      </div>
      <DeleteItem id={item.id} name={item.name} refs={refs} />
    </div>
  );
}
