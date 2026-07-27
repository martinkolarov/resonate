import { queryClient } from '@/lib/query-client';
import { HeroUIProvider } from '@heroui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ToastProvider } from './ToastProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <HeroUIProvider className="flex flex-col">
      <ToastProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ToastProvider>
    </HeroUIProvider>
  );
}
