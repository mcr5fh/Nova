/**
 * API Module - Main Exports
 *
 * Centralized export for all API-related functionality
 */

// Client exports
export { TraceAPIClient, apiClient } from './client';

// SSE exports
export { TraceSSEClient, createSSEClient } from './sse';
export type { SSEOptions } from './sse';

// React hooks exports
export {
  useTraces,
  useTask,
  useTaskTree,
  useSessionSummary,
  useHealthCheck,
  useTraceStream,
  queryKeys,
} from './hooks';
export type { UseTraceStreamOptions } from './hooks';
