import ItemForm from "@/components/admin/ItemForm";
import BackLink from "@/components/admin/BackLink";

export const dynamic = "force-dynamic";

export default function NewItemPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/admin/inventory" label="What you sell" />
      <h1 className="display text-2xl">ADD ITEM</h1>
      <div className="mt-8">
        <ItemForm />
      </div>
    </div>
  );
}
