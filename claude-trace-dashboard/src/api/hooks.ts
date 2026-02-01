/**
 * React Hooks for Claude Trace API
 *
 * Provides React Query hooks for fetching and managing trace data
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { apiClient } from './client';
import { createSSEClient } from './sse';
import type { QueryParams, TraceEvent } from '../types/api';

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  traces: (params?: QueryParams) => ['traces', params] as const,
  task: (taskId: string) => ['task', taskId] as const,
  taskTree: (taskId: string) => ['taskTree', taskId] as const,
  session: (sessionId: string) => ['session', sessionId] as const,
  health: () => ['health'] as const,
};

// ============================================================================
// Traces Hooks
// ============================================================================

export function useTraces(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.traces(params),
    queryFn: () => apiClient.getTraces(params),
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================================
// Task Hooks
// ============================================================================

export function useTask(taskId: string) {
  return useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: () => apiClient.getTask(taskId),
    enabled: !!taskId,
  });
}

export function useTaskTree(taskId: string) {
  return useQuery({
    queryKey: queryKeys.taskTree(taskId),
    queryFn: () => apiClient.getTaskTree(taskId),
    enabled: !!taskId,
  });
}

// ============================================================================
// Session Hooks
// ============================================================================

export function useSessionSummary(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => apiClient.getSessionSummary(sessionId),
    enabled: !!sessionId,
  });
}

// ============================================================================
// Health Check Hook
// ============================================================================

export function useHealthCheck() {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => apiClient.healthCheck(),
    refetchInterval: 60000, // Check every minute
    retry: 3,
  });
}

// ============================================================================
// SSE (Real-Time Streaming) Hook
// ============================================================================

export interface UseTraceStreamOptions {
  sessionId?: string;
  taskId?: string;
  onTrace?: (trace: TraceEvent) => void;
  enabled?: boolean;
}

export function useTraceStream(options: UseTraceStreamOptions = {}) {
  const { sessionId, taskId, onTrace, enabled = true } = options;
  const queryClient = useQueryClient();

  const handleTrace = useCallback(
    (trace: TraceEvent) => {
      // Update relevant queries in cache
      if (trace.task_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.task(trace.task_id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(trace.task_id) });
      }

      if (trace.session_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.session(trace.session_id) });
      }

      // Call user callback
      onTrace?.(trace);
    },
    [onTrace, queryClient]
  );

  useEffect(() => {
    if (!enabled) return;

    const sseClient = createSSEClient();

    sseClient.connect({
      sessionId,
      taskId,
      onTrace: handleTrace,
      onError: (error) => {
        console.error('SSE connection error:', error);
      },
      onOpen: () => {
        console.log('SSE connection established');
      },
    });

    return () => {
      sseClient.disconnect();
    };
  }, [enabled, sessionId, taskId, handleTrace]);
}
