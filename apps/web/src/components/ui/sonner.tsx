'use client';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useThemeMode } from '@/components/theme/theme-provider';

export function Toaster({ ...props }: ToasterProps) {
  const { themeMode } = useThemeMode();

  return (
    <Sonner
      theme={themeMode}
      richColors
      className="toaster group font-sans"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'rounded-lg shadow-lg backdrop-blur-sm',
          title: 'text-sm font-medium',
          description: 'text-sm opacity-90',
        },
      }}
      {...props}
    />
  );
}
