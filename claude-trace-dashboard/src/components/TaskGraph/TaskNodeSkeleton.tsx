import { Skeleton } from "@/components/ui/skeleton";

export function TaskNodeSkeleton() {
  return (
    <div className="relative glass rounded-lg shadow-lg min-w-[200px] max-w-[300px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3 h-3 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-10 rounded-md" />
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>

        <Skeleton className="h-3 w-32" />

        <div className="flex gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
