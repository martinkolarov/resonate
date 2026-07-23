import { Button, Divider } from '@heroui/react';
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

type AuthShellProps = {
  children: ReactNode;
  footer: ReactNode;
  title: string;
};

export function AuthShell({ children, footer, title }: AuthShellProps) {
  return (
    <div className="relative z-2 flex flex-col lg:flex-row min-h-dvh w-full items-center justify-start overflow-hidden bg-neutral-950 p-2 sm:p-4 lg:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-1 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"
      />

      <div className="relative lg:absolute z-10 lg:top-10 lg:right-10">
        <Logo className="text-white" />
      </div>

      <main className="rounded-large shadow-small z-3 flex w-full max-w-sm flex-col gap-4 bg-content1 px-8 pt-6 pb-10">
        <h1 className="pb-2 text-xl font-medium">{title}</h1>
        {children}

        <div className="flex items-center gap-4 py-2">
          <Divider className="flex-1" />
          <p className="text-tiny text-default-500 shrink-0">OR</p>
          <Divider className="flex-1" />
        </div>

        <div className="flex flex-col gap-2">
          <Button
            startContent={<Icon icon="flat-color-icons:google" width={24} />}
            variant="bordered"
          >
            Continue with Google
          </Button>
          <Button
            startContent={<Icon className="text-default-500" icon="fe:github" width={24} />}
            variant="bordered"
          >
            Continue with Github
          </Button>
        </div>

        <p className="text-small text-center">{footer}</p>
      </main>
    </div>
  );
}
