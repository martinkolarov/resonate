import { useQuery } from '@tanstack/react-query';
import { getSession } from '../auth.api';

export function useAuthUser() {
  const query = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
  });

  return {
    user: query.data?.user ?? null,
    isPending: query.isPending,
    error: query.error,
  };
}
