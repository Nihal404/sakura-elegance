export function ProductCardSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden bg-card shadow-soft">
      <div className="relative aspect-[3/4] bg-sakura-gradient animate-pulse">
        <span className="absolute top-4 left-4 h-5 w-20 rounded-full bg-background/70" />
      </div>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="h-4 flex-1 rounded-full bg-primary/10 animate-pulse" />
        <div className="h-4 w-12 rounded-full bg-primary/15 animate-pulse" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
