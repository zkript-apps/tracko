'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      richColors
      position="top-right"
      className="font-sans"
      toastOptions={{
        classNames: {
          toast: 'rounded-lg shadow-lg backdrop-blur-sm',
          title: 'text-sm font-medium',
          description: 'text-sm opacity-90',
        },
      }}
    />
  );
}
