'use client';

import { InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/cn';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M6.12 6.12A10.94 10.94 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 5.07-1.24" />
      <path d="M2 2l20 20" />
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
    </svg>
  );
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(
          'tracko-password-input w-full rounded-lg border border-border bg-background py-2 pl-3 pr-10 text-foreground outline-none ring-ring focus:ring-2 disabled:opacity-60',
          className,
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-primary transition hover:opacity-80"
      >
        {visible ? (
          <EyeOffIcon className="h-4 w-4" />
        ) : (
          <EyeIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
