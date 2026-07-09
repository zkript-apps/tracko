import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function NativeSelect({
  className,
  children,
  ...props
}: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          'w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 py-2 pl-3 pr-10 text-sm text-white outline-none ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}
