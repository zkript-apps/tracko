import * as React from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const dateInputClassName = cn(
  'pr-9',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
  '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
  '[&::-webkit-calendar-picker-indicator]:opacity-0',
);

const timeInputClassName = cn(
  'pr-9',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
  '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
  '[&::-webkit-calendar-picker-indicator]:opacity-0',
);

type DateInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export function DateInput({ className, ...props }: DateInputProps) {
  return (
    <div className="relative dark:[color-scheme:dark]">
      <Input
        type="date"
        className={cn(dateInputClassName, className)}
        {...props}
      />
      <CalendarDays
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

type TimeInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export function TimeInput({ className, ...props }: TimeInputProps) {
  return (
    <div className="relative dark:[color-scheme:dark]">
      <Input
        type="time"
        className={cn(timeInputClassName, className)}
        {...props}
      />
      <Clock
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
