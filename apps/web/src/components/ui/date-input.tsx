import * as React from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const dateInputClassName = cn(
  'min-w-0 max-w-full appearance-none',
  'pr-9',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:top-0',
  '[&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:bottom-0',
  '[&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer',
  '[&::-webkit-calendar-picker-indicator]:opacity-0',
  '[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left',
  '[&::-webkit-datetime-edit]:inline-flex [&::-webkit-datetime-edit]:min-w-0',
  '[&::-webkit-datetime-edit-fields-wrapper]:min-w-0',
);

const timeInputClassName = cn(
  'min-w-0 max-w-full appearance-none',
  'pr-9',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:top-0',
  '[&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:bottom-0',
  '[&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer',
  '[&::-webkit-calendar-picker-indicator]:opacity-0',
  '[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left',
  '[&::-webkit-datetime-edit]:inline-flex [&::-webkit-datetime-edit]:min-w-0',
  '[&::-webkit-datetime-edit-fields-wrapper]:min-w-0',
);

type DateInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export function DateInput({ className, ...props }: DateInputProps) {
  return (
    <div className="relative w-full min-w-0 dark:[color-scheme:dark]">
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
    <div className="relative w-full min-w-0 dark:[color-scheme:dark]">
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
