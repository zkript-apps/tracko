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
        'flex min-h-full flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400',
        className,
      )}
    >
      <Spinner size="lg" className="text-emerald-400" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
