import { getSessionSupabase } from "@/lib/supabase/session";
import CommerceForm from "@/components/admin/CommerceForm";
import { getCommerceSettings } from "@/lib/cart/pricing";

export const dynamic = "force-dynamic";

export default async function AdminCommerce() {
  const sb = await getSessionSupabase();
  if (!sb) return null;

  const settings = await getCommerceSettings(sb);
  const { data: row } = await sb
    .from("settings")
    .select("updated_by_name, updated_at")
    .eq("key", "commerce")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">TAX &amp; SHIPPING</h1>
      <p className="mt-4 max-w-[60ch] text-sm text-muted">
        What gets added to an order after the items. Both of these are
        charged to real cards once payments open, so they are worth getting
        right before then.
      </p>
      <div className="mt-10">
        <CommerceForm
          settings={settings}
          updatedBy={row?.updated_by_name ?? null}
          updatedAt={row?.updated_at ?? null}
        />
      </div>
    </div>
  );
}
