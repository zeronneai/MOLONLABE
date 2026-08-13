import { SkeletonBar } from "@/components/ui/Skeleton";

// Mirrors the detail layout: sticky gallery on the left, specs on the
// right, so the shape is right before the data lands.
export default function ItemLoading() {
  return (
    <div className="lg:flex">
      <div className="skeleton h-[60vh] w-full lg:h-svh lg:w-1/2" aria-hidden="true" />
      <div className="px-page w-full pb-24 pt-12 lg:w-1/2 lg:pt-[calc(72px+3rem)]">
        <SkeletonBar w="30%" h={11} />
        <div className="mt-6">
          <SkeletonBar w="80%" h={44} />
        </div>
        <div className="mt-4">
          <SkeletonBar w="55%" h={44} />
        </div>
        <div className="mt-10 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-8 border-b hairline pb-3">
              <SkeletonBar w="28%" h={12} />
              <SkeletonBar w="34%" h={12} />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading item
      </span>
    </div>
  );
}
