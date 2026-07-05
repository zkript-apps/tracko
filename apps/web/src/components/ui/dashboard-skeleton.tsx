import { Skeleton } from './skeleton';

export function DashboardSkeleton() {
  return (
    <div
      aria-busy
      aria-label="Loading dashboard"
      className="min-h-screen bg-background text-foreground"
    >
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-border bg-card p-4 lg:block">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-5 w-40" />
          <div className="mt-8 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        </aside>

        <div className="flex-1">
          <header className="flex h-14 items-center border-b border-border px-4 lg:hidden">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="ml-3 h-5 w-32" />
          </header>
          <main className="px-6 py-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-3 h-4 w-full max-w-xl" />
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="mt-3 h-8 w-16" />
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
