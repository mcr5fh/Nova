# Claude Trace Dashboard - Data Layer

## Overview

This directory contains the data layer implementation for the Claude Trace Dashboard, providing API clients, React hooks, and SSE (Server-Sent Events) streaming for real-time trace updates.

## Structure

```
api/
├── client.ts       # REST API client for trace server
├── sse.ts          # SSE client for real-time streaming
├── hooks.ts        # React Query hooks for data fetching
└── index.ts        # Public API exports
```

## Usage Examples

### 1. Using the API Client Directly

```typescript
import { apiClient } from '@/api';

// Fetch traces
const response = await apiClient.getTraces({
  session_id: 'abc123',
  limit: 50,
});

// Get task summary
const { task } = await apiClient.getTask('Nova-100');

// Get task tree
const tree = await apiClient.getTaskTree('Nova-100');

// Get session summary
const summary = await apiClient.getSessionSummary('session-abc123');

// Health check
const isHealthy = await apiClient.healthCheck();
```

### 2. Using React Hooks (Recommended)

```typescript
import { useTraces, useTask, useSessionSummary } from '@/api';

function TracesList() {
  const { data, isLoading, error } = useTraces({
    session_id: 'abc123',
    limit: 50,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.traces.map((trace) => (
        <li key={trace.span_id}>{trace.tool_name}</li>
      ))}
    </ul>
  );
}
```

### 3. Real-Time Streaming with SSE

```typescript
import { useTraceStream } from '@/api';

function LiveTraces() {
  const [traces, setTraces] = useState<TraceEvent[]>([]);

  useTraceStream({
    sessionId: 'abc123',
    onTrace: (trace) => {
      setTraces((prev) => [...prev, trace]);
    },
  });

  return (
    <div>
      <h2>Live Traces ({traces.length})</h2>
      {traces.map((trace) => (
        <div key={trace.span_id}>{trace.tool_name}</div>
      ))}
    </div>
  );
}
```

### 4. Using SSE Client Directly

```typescript
import { createSSEClient } from '@/api';

const sseClient = createSSEClient();

sseClient.connect({
  sessionId: 'abc123',
  onTrace: (trace) => {
    console.log('New trace:', trace);
  },
  onHeartbeat: (timestamp) => {
    console.log('Heartbeat:', timestamp);
  },
  onError: (error) => {
    console.error('SSE error:', error);
  },
  onOpen: () => {
    console.log('SSE connected');
  },
});

// Later, disconnect
sseClient.disconnect();
```

## Configuration

### API Base URL

Set the API base URL via environment variable:

```bash
# .env
VITE_API_BASE_URL=http://localhost:8080
```

Or pass it to the client constructor:

```typescript
import { TraceAPIClient } from '@/api';

const client = new TraceAPIClient('https://api.example.com');
```

## React Query Integration

All hooks use React Query for:
- Automatic caching
- Background refetching
- Optimistic updates
- Error handling
- Loading states

### Query Keys

Query keys are exported for manual cache invalidation:

```typescript
import { queryKeys, useQueryClient } from '@/api';

const queryClient = useQueryClient();

// Invalidate specific queries
queryClient.invalidateQueries({ queryKey: queryKeys.task('Nova-100') });
queryClient.invalidateQueries({ queryKey: queryKeys.traces({ session_id: 'abc123' }) });
```

## Mock Data

For development without a running backend, use mock data:

```typescript
import { mockAPI, mockTraces, mockTaskSummary } from '@/data';

// Use mock API
const traces = await mockAPI.getTraces();
const task = await mockAPI.getTask('Nova-100');
```

## Error Handling

API errors follow this structure:

```typescript
interface APIError {
  message: string;
  status: number;
  details?: unknown;
}
```

Example error handling:

```typescript
try {
  const data = await apiClient.getTraces();
} catch (error) {
  const apiError = error as APIError;
  console.error(`Error ${apiError.status}: ${apiError.message}`);
}
```

## TypeScript Types

All types are exported from `@/types`:

```typescript
import type {
  TraceEvent,
  TracesResponse,
  TaskSummary,
  TaskTreeNode,
  SessionSummary,
  QueryParams,
} from '@/types';
```

## Best Practices

1. **Use hooks in components** - Prefer `useTraces`, `useTask`, etc. over direct API calls
2. **Enable SSE streaming** - Use `useTraceStream` for real-time updates
3. **Handle loading states** - All hooks return `isLoading`, `error`, and `data`
4. **Cache invalidation** - SSE hook automatically invalidates related queries
5. **Mock data for development** - Use mock API when backend is unavailable

## Testing

The data layer can be tested with mock data:

```typescript
import { mockAPI } from '@/data';

// Replace real API with mock in tests
jest.mock('@/api/client', () => ({
  apiClient: mockAPI,
}));
```

## Related Documentation

- [Trace Server Specification](../../../../thoughts/shared/specs/claude-trace/03-trace-server-specification.md)
- [API Types](../types/api.ts)
- [Mock Data](../data/mockTraces.ts)
