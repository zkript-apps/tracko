import { cn } from '@/lib/cn';

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'skeleton-shimmer animate-pulse rounded-lg bg-[var(--skeleton,var(--muted))]',
        className,
      )}
    />
  );
}
