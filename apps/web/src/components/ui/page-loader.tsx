import { Spinner } from './spinner';
import { cn } from '@/lib/cn';

type PageLoaderProps = {
  label?: string;
  className?: string;
};

export function PageLoader({ label = 'Loading…', className }: PageLoaderProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground',
        className,
      )}
    >
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
