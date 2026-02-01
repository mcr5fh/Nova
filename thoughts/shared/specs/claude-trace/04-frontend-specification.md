# Claude Trace Frontend - React Dashboard Specification

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-01-31

## Overview

A React + TypeScript dashboard for visualizing Claude Code traces in real-time with:
- **Live updates** via Server-Sent Events
- **Interactive task hierarchy** using Mermaid.js
- **Cost & token analytics** with Recharts
- **Trace timeline** view
- **Session management** and filtering

### MVP Scope (Minimal)
- **Pages:** Dashboard `/`, Session detail `/sessions/:id`, Task detail `/tasks/:id`
- **Core UI:** Header + left sidebar + main grid (Option A layout)
- **Interactive graph:** React Flow task graph with hover/click + expand/collapse
- **Trace table:** Virtualized list of recent traces
- **Analytics:** Cost + tokens (basic charts only)
- **States:** Loading, empty, error, SSE disconnected
- **Data source:** Local dummy JSON (no backend required for MVP)

---

## Tech Stack (2026 Best Practices)

### Core
- **React 19** - Server Components, useOptimistic, use() hook
- **TypeScript 5.7+** - Strict mode, type-safe APIs
- **Vite 6** - Fast dev server, HMR

### Data Management
- **TanStack Query v5** - Server state, caching, real-time sync
- **Zustand** - Client state (UI filters, selected items)

### Visualization
- **Mermaid.js 11.12+** - Task hierarchy diagrams
- **Recharts** - Cost/token analytics charts
- **TanStack Table v8** - Trace event tables
- **React Flow** - Interactive task graph (pan/zoom, hover/click, expand/collapse)

### Styling
- **Tailwind CSS 4** - Utility-first styling
- **Shadcn/ui** - Component primitives

### Design System (Crisp Tech)
- **Primary UI font:** Sora (clean, technical)
- **Mono/data font:** IBM Plex Mono (IDs, payloads, timestamps)
- **Type scale (px):** 12 (meta), 13 (table), 14 (body), 16 (section), 20 (card title), 28 (page title)
- **Weights:** 400/500/600; 700 only for page title
- **Line height:** 1.4–1.5 body, 1.2 headings
- **Letter spacing:** -0.01em headings, 0 body
- **Palette:** soft neutral background, off-white cards, teal accents
- **Status colors:** green / amber / red / gray (shared across charts + nodes)

### CSS Variables (Design Tokens)
```css
:root {
  --bg-0: #f6f7f8;
  --bg-1: #eef1f3;
  --card: #ffffff;
  --text-0: #0f172a;
  --text-1: #334155;
  --text-2: #64748b;
  --border: #e2e8f0;
  --accent: #14b8a6;
  --accent-2: #0ea5a4;

  --status-green: #22c55e;
  --status-amber: #f59e0b;
  --status-red: #ef4444;
  --status-gray: #94a3b8;

  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08);
}
```

### Tailwind Config Snippet
```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular'],
      },
      colors: {
        bg: {
          0: '#f6f7f8',
          1: '#eef1f3',
        },
        card: '#ffffff',
        text: {
          0: '#0f172a',
          1: '#334155',
          2: '#64748b',
        },
        border: '#e2e8f0',
        accent: {
          DEFAULT: '#14b8a6',
          2: '#0ea5a4',
        },
        status: {
          green: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
          gray: '#94a3b8',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08)',
      },
    },
  },
};
```

### Real-Time
- **EventSource API** - Native SSE support
- **Custom useSSE hook** - Manage connections

---

## Project Structure

```
claude-trace-dashboard/
├── src/
│   ├── api/
│   │   ├── client.ts              # API client with types
│   │   ├── hooks.ts               # React Query hooks
│   │   └── sse.ts                 # SSE hook
│   ├── components/
│   │   ├── TaskTree/
│   │   │   ├── TaskTree.tsx       # Mermaid diagram wrapper
│   │   │   ├── MermaidRenderer.tsx
│   │   │   └── TaskNode.tsx       # Click handlers
│   │   ├── Timeline/
│   │   │   ├── Timeline.tsx       # Span timeline view
│   │   │   └── TimelineItem.tsx
│   │   ├── Analytics/
│   │   │   ├── CostChart.tsx      # Recharts cost over time
│   │   │   ├── TokenChart.tsx     # Token usage
│   │   │   └── ToolUsage.tsx      # Tool breakdown
│   │   ├── TraceTable/
│   │   │   ├── TraceTable.tsx     # TanStack Table
│   │   │   └── columns.tsx        # Column definitions
│   │   └── Layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Layout.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   ├── SessionView.tsx        # Single session detail
│   │   └── TaskDetail.tsx         # Single task drill-down
│   ├── stores/
│   │   └── uiStore.ts             # Zustand store (filters, UI state)
│   ├── types/
│   │   └── api.ts                 # TypeScript types from API
│   ├── lib/
│   │   └── utils.ts               # Helper functions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Core Implementation

## MVP Dummy Data Seed (No Backend Required)

To enable fast UI iteration without a backend, seed the app with local JSON that matches the API response shapes.
See [Data Contracts](./01-data-contracts.md) for canonical field definitions.

### Approach
- Store JSON in `src/data/` (e.g., `sessions.json`, `tasks.json`, `traces.json`)
- Provide a lightweight mock API layer that returns the same shape as real endpoints
- Gate with a flag (e.g., `VITE_USE_MOCK_DATA=true`)

### Example Structure
```
src/
  data/
    sessions.json
    tasks.json
    traces.json
```

### Mock API Contract
- `getTraces` returns `{ traces: TraceEvent[]; total: number }`
- `getTask` returns `{ task: AggregatedTaskTrace }`
- `getTaskTree` returns `{ root, children }`
- `getSessionSummary` returns `SessionSummary`

### Notes
- Keep timestamps realistic and ordered to exercise timeline + charts
- Include multiple sessions and task states (completed/in_progress/blocked)
- Use the same ID formats as production (session_id, task_id, span_id)

### 1. API Client

**File:** `src/api/client.ts`

Type-safe API client using Fetch API:

```typescript
import type { TraceEvent, AggregatedTaskTrace, SessionSummary } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = {
  // Get traces with filters
  async getTraces(params: {
    session_id?: string;
    task_id?: string;
    tool_name?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ traces: TraceEvent[]; total: number }> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v != null) as [string, string][]
    );

    const res = await fetch(`${API_BASE_URL}/api/traces?${query}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get aggregated task
  async getTask(taskId: string): Promise<AggregatedTaskTrace> {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.task;
  },

  // Get task hierarchy
  async getTaskTree(taskId: string) {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/tree`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Get session summary
  async getSessionSummary(sessionId: string): Promise<SessionSummary> {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
```

### 2. SSE Hook

**File:** `src/api/sse.ts`

Custom React hook for Server-Sent Events with automatic reconnection:

```typescript
import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TraceEvent } from './types';

interface UseSSEOptions {
  sessionId?: string;
  taskId?: string;
  enabled?: boolean;
}

export function useSSE({ sessionId, taskId, enabled = true }: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    if (taskId) params.set('task_id', taskId);

    const url = `${import.meta.env.VITE_API_URL}/api/stream?${params}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('SSE connected');
    };

    eventSource.addEventListener('trace', (e) => {
      try {
        const trace: TraceEvent = JSON.parse(e.data);

        // Update local state
        setEvents(prev => [...prev, trace]);

        // Update React Query cache
        queryClient.setQueryData<TraceEvent[]>(
          ['traces', sessionId, taskId],
          (old = []) => [...old, trace]
        );

        // Invalidate aggregated queries to trigger refetch
        if (trace.task_id) {
          queryClient.invalidateQueries({ queryKey: ['task', trace.task_id] });
        }

        console.log('Received trace:', trace.span_id);
      } catch (err) {
        console.error('Failed to parse trace event:', err);
      }
    });

    eventSource.addEventListener('heartbeat', (e) => {
      const data = JSON.parse(e.data);
      console.log('Heartbeat:', data.timestamp);
    });

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setIsConnected(false);
      setError(new Error('Connection lost'));
      // Browser automatically reconnects
    };

    return () => {
      console.log('Closing SSE connection');
      eventSource.close();
    };
  }, [sessionId, taskId, enabled, queryClient]);

  return { isConnected, error, events };
}
```

### 3. React Query Hooks

**File:** `src/api/hooks.ts`

```typescript
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from './client';

// Fetch traces with React Query
export function useTraces(params: Parameters<typeof api.getTraces>[0]) {
  return useQuery({
    queryKey: ['traces', params.session_id, params.task_id],
    queryFn: () => api.getTraces(params),
    staleTime: Infinity, // SSE keeps it fresh
  });
}

// Fetch single task
export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.getTask(taskId!),
    enabled: !!taskId,
    staleTime: 30000, // 30 seconds
  });
}

// Fetch task tree
export function useTaskTree(taskId: string | undefined) {
  return useQuery({
    queryKey: ['taskTree', taskId],
    queryFn: () => api.getTaskTree(taskId!),
    enabled: !!taskId,
  });
}

// Fetch session summary
export function useSessionSummary(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['sessionSummary', sessionId],
    queryFn: () => api.getSessionSummary(sessionId!),
    enabled: !!sessionId,
  });
}

// Infinite scroll for traces
export function useInfiniteTraces(params: Omit<Parameters<typeof api.getTraces>[0], 'offset'>) {
  return useInfiniteQuery({
    queryKey: ['traces', 'infinite', params],
    queryFn: ({ pageParam = 0 }) =>
      api.getTraces({ ...params, offset: pageParam }),
    getNextPageParam: (lastPage, pages) => {
      const nextOffset = pages.length * (params.limit || 100);
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    initialPageParam: 0,
  });
}
```

### 4. Zustand Store (UI State)

**File:** `src/stores/uiStore.ts`

```typescript
import { create } from 'zustand';

interface UIState {
  // Selected items
  selectedSessionId: string | null;
  selectedTaskId: string | null;

  // Filters
  filters: {
    timeRange: { from: string; to: string };
    toolNames: string[];
    taskStatus: string[];
  };

  // UI state
  sidebarOpen: boolean;

  // Actions
  setSelectedSession: (id: string | null) => void;
  setSelectedTask: (id: string | null) => void;
  setFilters: (filters: Partial<UIState['filters']>) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedSessionId: null,
  selectedTaskId: null,
  filters: {
    timeRange: { from: '', to: '' },
    toolNames: [],
    taskStatus: [],
  },
  sidebarOpen: true,

  setSelectedSession: (id) => set({ selectedSessionId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  reset: () =>
    set({
      selectedSessionId: null,
      selectedTaskId: null,
      filters: { timeRange: { from: '', to: '' }, toolNames: [], taskStatus: [] },
    }),
}));
```

### 5. Task Tree Visualization (Mermaid)

**File:** `src/components/TaskTree/TaskTree.tsx`

```typescript
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { useTaskTree } from '@/api/hooks';
import type { AggregatedTaskTrace } from '@/types/api';

interface TaskTreeProps {
  taskId: string;
  onNodeClick?: (taskId: string) => void;
}

export function TaskTree({ taskId, onNodeClick }: TaskTreeProps) {
  const { data: tree, isLoading } = useTaskTree(taskId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tree || !containerRef.current) return;

    const diagram = buildMermaidDiagram(tree);

    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose', // Allow click handlers
    });

    // Render diagram
    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render('task-tree', diagram);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;

          // Add click handlers
          containerRef.current.querySelectorAll('[data-task-id]').forEach((node) => {
            node.addEventListener('click', () => {
              const id = node.getAttribute('data-task-id');
              if (id && onNodeClick) onNodeClick(id);
            });
          });
        }
      } catch (err) {
        console.error('Failed to render Mermaid diagram:', err);
      }
    };

    renderDiagram();
  }, [tree, onNodeClick]);

  if (isLoading) return <div>Loading task tree...</div>;

  return (
    <div className="task-tree-container">
      <div ref={containerRef} className="mermaid-diagram" />
    </div>
  );
}

function buildMermaidDiagram(tree: any): string {
  const { root, children } = tree;

  let diagram = 'graph TD\n';

  // Add root node
  diagram += `  ${root.task_id}["${root.task_description}<br/>${formatMetrics(root)}"]\n`;
  diagram += `  style ${root.task_id} fill:#f9f,stroke:#333,stroke-width:4px\n`;

  // Add children recursively
  for (const child of children) {
    diagram += `  ${child.task_id}["${child.task_description}<br/>${formatMetrics(child)}"]\n`;
    diagram += `  ${root.task_id} --> ${child.task_id}\n`;

    // Style by status
    const fillColor = getStatusColor(child.status);
    diagram += `  style ${child.task_id} fill:${fillColor},stroke:#333\n`;
  }

  return diagram;
}

function formatMetrics(task: AggregatedTaskTrace): string {
  const duration = task.duration_ms
    ? formatDuration(task.duration_ms)
    : 'In progress';
  const cost = task.total_cost ? `$${task.total_cost.toFixed(2)}` : '$0.00';
  const tokens = task.total_tokens
    ? `${(task.total_tokens / 1000).toFixed(1)}K tokens`
    : '0 tokens';

  return `${duration} | ${cost} | ${tokens}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return '#9f9'; // Green
    case 'in_progress':
      return '#ff9'; // Yellow
    case 'blocked':
      return '#f99'; // Red
    default:
      return '#ccc'; // Gray
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
```

---

## Interactive Task Graph (React Flow)

Mermaid is retained for quick static diagrams, but the primary interactive graph should use React Flow for usability and control.

### Why React Flow
- Smooth pan/zoom, selection, and minimap out of the box
- Full control over node rendering and hover/click behavior
- Better performance via progressive disclosure (render only active subtrees)

### Expected Capabilities
- **Labels:** task name + status + key metrics
- **Hover:** tooltip with duration, cost, tokens, status
- **Click:** open right panel or route to `/tasks/:id`
- **Double-click:** focus mode (dim unrelated branches / zoom to subtree)
- **Expand/Collapse:** load children on demand

### Performance Guardrails
- Cap visible nodes (e.g., 200–500)
- Lazy-load and render children only when expanded
- Focus mode to show only selected subtree
- `React.memo` for node components + edges
- Disable physics; static layout only

### Layout
Use ELK or Dagre to generate a clean hierarchical layout. Recompute layout on expand/collapse.

### Data Flow
- Convert task tree to React Flow nodes/edges
- Store expanded node IDs in UI state
- On expand: fetch children (if needed), update graph data, re-layout

### 6. Cost Analytics Chart

**File:** `src/components/Analytics/CostChart.tsx`

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTraces } from '@/api/hooks';

interface CostChartProps {
  sessionId: string;
}

export function CostChart({ sessionId }: CostChartProps) {
  const { data: traces } = useTraces({ session_id: sessionId, limit: 1000 });

  if (!traces) return <div>Loading...</div>;

  // Aggregate cost over time
  const data = traces.traces
    .filter((t) => t.metrics.estimated_cost)
    .reduce((acc, trace) => {
      const timestamp = new Date(trace.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
      const existing = acc.find((d) => d.date === timestamp);

      if (existing) {
        existing.cost += trace.metrics.estimated_cost || 0;
        existing.tokens += trace.metrics.input_tokens || 0;
        existing.tokens += trace.metrics.output_tokens || 0;
      } else {
        acc.push({
          date: timestamp,
          cost: trace.metrics.estimated_cost || 0,
          tokens: (trace.metrics.input_tokens || 0) + (trace.metrics.output_tokens || 0),
        });
      }

      return acc;
    }, [] as { date: string; cost: number; tokens: number }[]);

  return (
    <div className="cost-chart">
      <h3>Cost Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Tokens', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#8884d8" name="Cost ($)" />
          <Line yAxisId="right" type="monotone" dataKey="tokens" stroke="#82ca9d" name="Tokens" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 7. Main Dashboard

**File:** `src/pages/Dashboard.tsx`

```typescript
import { useState } from 'react';
import { useSSE } from '@/api/sse';
import { useSessionSummary } from '@/api/hooks';
import { useUIStore } from '@/stores/uiStore';
import { TaskTree } from '@/components/TaskTree/TaskTree';
import { CostChart } from '@/components/Analytics/CostChart';
import { TraceTable } from '@/components/TraceTable/TraceTable';

export function Dashboard() {
  const { selectedSessionId, setSelectedTask } = useUIStore();
  const [currentSessionId] = useState('abc123'); // TODO: Get from session selector

  // Connect to SSE stream
  const { isConnected, events } = useSSE({
    sessionId: currentSessionId,
    enabled: true,
  });

  // Fetch session summary
  const { data: summary } = useSessionSummary(currentSessionId);

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Claude Trace Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </span>
          <span className="text-sm text-gray-500">
            {events.length} events received
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="grid grid-cols-2 gap-4 p-4">
        {/* Task Tree */}
        <div className="col-span-2 bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4">Task Hierarchy</h2>
          {summary?.tasks.total > 0 ? (
            <TaskTree
              taskId={currentSessionId}
              onNodeClick={(taskId) => setSelectedTask(taskId)}
            />
          ) : (
            <p className="text-gray-500">No tasks yet...</p>
          )}
        </div>

        {/* Cost Analytics */}
        <div className="bg-white rounded-lg shadow p-4">
          <CostChart sessionId={currentSessionId} />
        </div>

        {/* Summary Stats */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Session Summary</h3>
          {summary && (
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-500">Total Traces:</dt>
                <dd className="text-2xl font-bold">{summary.total_traces}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total Cost:</dt>
                <dd className="text-2xl font-bold">${summary.total_cost.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total Tokens:</dt>
                <dd className="text-2xl font-bold">{(summary.total_tokens / 1000).toFixed(1)}K</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Recent Traces */}
        <div className="col-span-2 bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Recent Traces</h3>
          <TraceTable sessionId={currentSessionId} />
        </div>
      </div>
    </div>
  );
}
```

---

## Build & Development

### package.json

```json
{
  "name": "claude-trace-dashboard",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.50.0",
    "zustand": "^5.0.0",
    "mermaid": "^11.12.0",
    "recharts": "^2.15.0",
    "@tanstack/react-table": "^8.21.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "eslint": "^9.0.0"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Paths */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## Running the Dashboard

```bash
# Install dependencies
npm install

# Start dev server (with Vite HMR)
npm run dev
# → http://localhost:3000

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Key Features

### 1. Real-Time Updates

SSE keeps the dashboard in sync automatically:
- New traces appear instantly
- Task metrics update live
- Cost accumulates in real-time
- No manual refresh needed

### 2. Interactive Task Tree

Click nodes to drill down:
```typescript
<TaskTree
  taskId={rootTaskId}
  onNodeClick={(taskId) => {
    // Navigate to task detail page
    navigate(`/tasks/${taskId}`);
  }}
/>
```

### 3. Responsive Design

Tailwind CSS breakpoints:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Adapts to screen size */}
</div>
```

---

## Performance Optimizations

### 1. React Query Caching

```typescript
// Stale time prevents unnecessary refetches
useQuery({
  queryKey: ['traces', sessionId],
  queryFn: () => api.getTraces({ session_id: sessionId }),
  staleTime: Infinity, // SSE keeps it fresh
});
```

### 2. Component Memoization

```typescript
import { memo } from 'react';

export const TraceItem = memo(({ trace }: { trace: TraceEvent }) => {
  return <div>{trace.tool_name}</div>;
});
```

### 3. Virtual Scrolling

For large trace tables:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTraceTable({ traces }: { traces: TraceEvent[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: traces.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Row height
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <TraceItem key={virtualRow.index} trace={traces[virtualRow.index]} />
        ))}
      </div>
    </div>
  );
}
```

---

## Testing

### Unit Tests (Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskTree } from './TaskTree';

describe('TaskTree', () => {
  it('renders task hierarchy', async () => {
    render(<TaskTree taskId="NOV-123" />);
    expect(await screen.findByText(/Task Tree/)).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('dashboard shows live updates', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Wait for SSE connection
  await expect(page.locator('text=Connected')).toBeVisible();

  // Trigger trace event (via API or hook)
  // ...

  // Verify new trace appears
  await expect(page.locator('text=New trace')).toBeVisible();
});
```

---

## Deployment

### Static Build

```bash
npm run build
# → dist/

# Serve with any static host
npx serve dist
```

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Future Enhancements

### Phase 2
- Dark mode support
- Export traces to CSV/JSON
- Advanced filtering UI
- Keyboard shortcuts

### Phase 3
- Collaborative dashboards (multiple users)
- Custom metric definitions
- Alerts/notifications
- AI-powered insights

---

## References

- [Unified Architecture](./05-unified-architecture.md) - **System overview** - Complete system design
- [Data Contracts](./01-data-contracts.md) - API types
- [Trace Server](./03-trace-server-specification.md) - SSE endpoint
- [React 19 Docs](https://react.dev/blog/2024/12/05/react-19)
- [TanStack Query](https://tanstack.com/query/latest)
- [Mermaid.js](https://mermaid.js.org/)
- [Recharts](https://recharts.org/)
