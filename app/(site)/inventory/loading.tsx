import { SkeletonBar, SkeletonRows } from "@/components/ui/Skeleton";

export default function InventoryLoading() {
  return (
    <div className="px-page pb-24 pt-[calc(72px+3rem)]">
      <p className="label text-acid">Inventory</p>
      <div className="mt-6 max-w-3xl">
        <SkeletonBar w="62%" h={64} />
      </div>
      <div className="mt-8 flex gap-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} w="64px" h={12} />
        ))}
      </div>
      <div className="mt-10">
        <SkeletonRows rows={6} />
      </div>
      <span className="sr-only" role="status">
        Loading inventory
      </span>
    </div>
  );
}
