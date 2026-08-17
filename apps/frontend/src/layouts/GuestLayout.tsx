import { useAuthUser } from '@/features/auth/hooks/use-auth-user';
import { Spinner } from '@heroui/react';
import { Navigate, Outlet } from 'react-router';

export function GuestLayout() {
  const { user, isPending } = useAuthUser();

  if (isPending) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner label="Loading session" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
