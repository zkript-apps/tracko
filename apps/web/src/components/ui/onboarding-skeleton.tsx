import { Skeleton } from './skeleton';

export function OnboardingSkeleton() {
  return (
    <div
      aria-busy
      aria-label="Loading onboarding"
      className="min-h-screen bg-background px-4 py-12"
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 space-y-3 text-center">
          <Skeleton className="mx-auto h-3 w-36" />
          <Skeleton className="mx-auto h-9 w-72" />
          <Skeleton className="mx-auto h-4 w-56" />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
