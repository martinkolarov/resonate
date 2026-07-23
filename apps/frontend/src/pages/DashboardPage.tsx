import { useAuthUser } from '@/features/auth/hooks/use-auth-user';

export default function DashboardPage() {
  const { user, isPending, error } = useAuthUser();
  return (
    <>
      <title>Dashboard | Resonate</title>
      <p>{user?.email}</p>
      <p>{String(isPending)}</p>
      <p>{error?.message}</p>
    </>
  );
}
