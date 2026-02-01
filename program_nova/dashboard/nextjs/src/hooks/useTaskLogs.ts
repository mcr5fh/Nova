'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTaskLogs } from '@/lib/api';
import type { TaskStatus } from '@/types';

const POLL_INTERVAL = 2000;

interface UseTaskLogsOptions {
  taskId: string;
  taskStatus?: TaskStatus;
  enabled?: boolean;
}

export function useTaskLogs({ taskId, taskStatus, enabled = true }: UseTaskLogsOptions) {
  const shouldPoll = taskStatus === 'in_progress';

  return useQuery({
    queryKey: ['taskLogs', taskId],
    queryFn: () => fetchTaskLogs(taskId),
    refetchInterval: shouldPoll ? POLL_INTERVAL : false,
    enabled: enabled && !!taskId,
    staleTime: 0,
  });
}
