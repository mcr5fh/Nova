'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchStatus, fetchBeadStatus } from '@/lib/api';
import { useNavigation } from '@/context';

const POLL_INTERVAL = 1000;

export function useStatus() {
  const { mode, epicId } = useNavigation();

  return useQuery({
    queryKey: mode === 'cascade'
      ? ['status', 'cascade']
      : ['status', 'bead', epicId],
    queryFn: () => mode === 'cascade'
      ? fetchStatus()
      : fetchBeadStatus(epicId!),
    refetchInterval: (query) => {
      if (query.state.data?.all_tasks_completed) {
        return false;
      }
      return POLL_INTERVAL;
    },
    enabled: mode === 'cascade' || !!epicId,
    staleTime: 0,
  });
}
