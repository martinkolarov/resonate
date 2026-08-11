import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/features/auth/auth.api';

export function useAuthUser() {
  const { data, isPending, error } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
  });

  return {
    user: data?.user ?? null,
    isPending: isPending,
    error: error,
  };
}
