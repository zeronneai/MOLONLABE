import { SkeletonBar } from "@/components/ui/Skeleton";

export default function FeaturedLoading() {
  return (
    <div className="pb-24">
      <div className="skeleton min-h-[70vh] w-full" aria-hidden="true" />
      <div className="px-page mt-14">
        <div className="grid grid-cols-1 gap-8 border-y hairline py-8 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <SkeletonBar w="40%" h={36} />
              <div className="mt-3">
                <SkeletonBar w="60%" h={11} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading the current feature
      </span>
    </div>
  );
}
