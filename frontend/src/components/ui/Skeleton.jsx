export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-stone-200/80 ${className}`} />;
}

// A row shaped like a list item (avatar dot + two lines) — used wherever
// a page currently shows a plain "Loading..." sentence for a list.
export function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 p-4">
      <Skeleton className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-[260px] w-full rounded-xl" />
    </div>
  );
}
