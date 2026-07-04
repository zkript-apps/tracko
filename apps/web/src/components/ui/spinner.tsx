import { cn } from '@/lib/cn';

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
};

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn('inline-block shrink-0', className)}
    >
      <span
        className={cn(
          'block animate-spin rounded-full border-current border-t-transparent',
          sizeClasses[size],
        )}
      />
    </span>
  );
}
