import { Button, ScrollShadow, Spinner, useDisclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { Navigate, Outlet } from 'react-router';
import { Logo } from '@/components/Logo';
import Sidebar from '@/components/Sidebar';
import SidebarDrawer from '@/components/SidebarDrawer';
import { useAuthUser } from '@/features/auth/hooks/use-auth-user';

export const sidebarItems = [
  {
    key: 'dashboard',
    href: '/dashboard',
    icon: 'solar:home-2-outline',
    title: 'Dashboard',
  },
  {
    key: 'recordings',
    href: '/recordings',
    icon: 'solar:file-outline',
    title: 'Recordings',
  },
  {
    key: 'settings',
    href: '/settings',
    icon: 'solar:settings-outline',
    title: 'Settings',
  },
];

export default function DashboardLayout() {
  const { isOpen, onClose, onOpen, onOpenChange } = useDisclosure();
  const { user, isPending, error } = useAuthUser();

  if (isPending) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner label="Loading session" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-danger text-sm">Unable to verify your session.</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="flex h-dvh">
      <SidebarDrawer isOpen={isOpen} onOpenChange={onOpenChange}>
        <aside className="border-r-small border-divider flex h-full w-72 shrink-0 flex-col overflow-hidden bg-background p-6">
          <div className="mb-8 flex shrink-0 items-center">
            <Logo className="h-4 text-foreground" />
          </div>

          <ScrollShadow className="min-h-0 flex-1">
            <Sidebar defaultSelectedKey="dashboard" items={sidebarItems} onSelect={onClose} />
          </ScrollShadow>
        </aside>
      </SidebarDrawer>

      <main className="relative min-w-0 flex-1 overflow-auto">
        <Button
          isIconOnly
          aria-label="Open sidebar"
          className="fixed top-4 left-4 z-30 sm:hidden"
          variant="flat"
          onPress={onOpen}
        >
          <Icon icon="solar:hamburger-menu-linear" width={24} />
        </Button>
        <Outlet />
      </main>
    </div>
  );
}
