// Loading skeletons. Shaped like the content they stand in for — editorial
// rows, not spinner discs — so the page doesn't jump when the real thing
// lands. Sunken surfaces, matching the field material.

export function SkeletonBar({ w = "100%", h = 14 }: { w?: string; h?: number }) {
  return (
    <span
      aria-hidden="true"
      className="skeleton block"
      style={{ width: w, height: h }}
    />
  );
}

/** The editorial index: numbered rows with a name and a status chip. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border-t hairline" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-8 border-b hairline py-8"
          style={{ opacity: 1 - i * 0.13 }}
        >
          <div className="flex flex-1 items-center gap-8">
            <SkeletonBar w="24px" h={11} />
            <SkeletonBar w={`${52 - i * 6}%`} h={22} />
          </div>
          <SkeletonBar w="88px" h={24} />
        </div>
      ))}
    </div>
  );
}
