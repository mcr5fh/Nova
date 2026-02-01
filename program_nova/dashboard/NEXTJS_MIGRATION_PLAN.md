# Program Nova Dashboard: Next.js Migration Plan

## Overview
Migrate the Program Nova dashboard from vanilla JS/HTML (~2800 lines) to Next.js 14 with TypeScript and Tailwind CSS, while keeping the existing FastAPI backend.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Router | App Router | Future-proof, better layouts support |
| Data Fetching | TanStack Query | Built-in polling, caching, devtools |
| State | React Context + Query | Server state in Query, nav state in Context |
| Styling | Tailwind CSS | Easy port of CSS variables, dark theme |
| Deployment | Static Export | `next build` outputs to `out/`, served by FastAPI |

## Project Structure

```
program_nova/dashboard/
├── nextjs/                      # New Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Root layout, providers
│   │   │   ├── page.tsx         # Main dashboard
│   │   │   └── globals.css      # Tailwind + custom vars
│   │   │
│   │   ├── components/
│   │   │   ├── layout/          # Header, Breadcrumbs, StatusIndicator
│   │   │   ├── views/           # L0, L1, L2, L3 view components
│   │   │   ├── tree/            # TreeView, TreeNode
│   │   │   ├── graph/           # DependencyGraph (SVG)
│   │   │   ├── cards/           # BranchCard, GroupCard
│   │   │   ├── tasks/           # TasksTable, TaskDetail
│   │   │   ├── logs/            # LogViewer with auto-scroll
│   │   │   └── mode/            # ModeSelector, EpicSelector
│   │   │
│   │   ├── hooks/               # useStatus, useTaskLogs, useNavigation
│   │   ├── lib/                 # api.ts, formatters.ts, constants.ts
│   │   ├── types/               # TypeScript interfaces
│   │   └── context/             # NavigationContext
│   │
│   ├── next.config.js           # output: 'export', distDir: '../out'
│   ├── tailwind.config.ts
│   └── package.json
│
├── out/                         # Built static files (gitignored)
├── static/                      # Old files (remove after migration)
└── server.py                    # Update to serve from out/
```

## Implementation Steps

### Phase 1: Project Setup
1. Create Next.js project: `npx create-next-app@latest nextjs --typescript --tailwind --app --no-src-dir`
2. Move to `src/` structure, configure paths
3. Install dependencies: `@tanstack/react-query`
4. Configure `next.config.js` for static export
5. Set up Tailwind with custom colors from existing CSS variables
6. Create TypeScript types matching API responses

### Phase 2: Core Infrastructure
1. Create `NavigationContext` for view state (L0/L1/L2/L3, mode, epicId)
2. Create `Providers` component (QueryClient, Navigation)
3. Create API client functions (`lib/api.ts`)
4. Create formatters (`formatDuration`, `formatCost`, `formatNumber`)
5. Create `useStatus` hook with 1-second polling via TanStack Query

### Phase 3: Layout Components
1. `Header` - title, mode selector, project stats
2. `Breadcrumbs` - clickable navigation path
3. `BackButton` - conditional back navigation
4. `StatusIndicator` - fixed position connection status
5. `ProgressBar` - animated progress display

### Phase 4: View Components
1. `L0ProjectView` - progress bar, branches grid, view tabs
2. `L1BranchView` - branch stats, groups grid
3. `L2GroupView` - group stats, tasks table
4. `L3TaskView` - task info, token usage, log viewer
5. `ViewRouter` - conditional rendering based on navigation state

### Phase 5: Complex Features
1. `TreeView` + `TreeNode` - collapsible hierarchy with status indicators
2. `DependencyGraph` - SVG-based graph with:
   - Topological level calculation
   - Node positioning
   - Curved edge paths with arrowheads
   - Click navigation to task detail
3. `LogViewer` - auto-scroll, conditional polling for in-progress tasks
4. `ModeSelector` + `EpicSelector` - Cascade/Bead mode switching

### Phase 6: Integration
1. Update `server.py` to serve from `out/` directory
2. Configure dev proxy for API calls
3. Test all features match existing behavior
4. Remove old `static/` directory

## Key Files to Modify

| File | Change |
|------|--------|
| `server.py` | Update `STATIC_DIR` to point to `out/` |

## Key Files to Create

| File | Purpose |
|------|---------|
| `nextjs/src/app/layout.tsx` | Root layout with providers |
| `nextjs/src/app/page.tsx` | Main dashboard page |
| `nextjs/src/context/NavigationContext.tsx` | View state management |
| `nextjs/src/hooks/useStatus.ts` | TanStack Query polling hook |
| `nextjs/src/components/graph/DependencyGraph.tsx` | SVG dependency visualization |
| `nextjs/src/components/logs/LogViewer.tsx` | Log display with auto-scroll |
| `nextjs/src/types/api.ts` | TypeScript interfaces for API |

## TypeScript Types

```typescript
// types/api.ts
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  name: string;
  status: TaskStatus;
  started_at?: string;
  completed_at?: string;
  duration_seconds: number;
  token_usage: TokenUsage;
  worker_id?: string;
  commit_sha?: string;
  files_changed?: string[];
  error?: string;
}

export interface TaskDefinition {
  name: string;
  branch: string;
  group: string;
  depends_on: string[];
}

export interface Rollup {
  status: TaskStatus;
  duration_seconds: number;
  token_usage: TokenUsage;
  cost_usd: number;
}

export interface Rollups {
  l0_rollup: Rollup;
  l1_rollups: Record<string, Rollup>;
  l2_rollups: Record<string, Record<string, Rollup>>;
}

export interface Hierarchy {
  [l1: string]: {
    [l2: string]: string[];
  };
}

export interface StatusResponse {
  project: { name: string };
  tasks: Record<string, Task>;
  rollups: Rollups;
  hierarchy: Hierarchy;
  milestones: any[];
  all_tasks_completed: boolean;
  task_definitions: Record<string, TaskDefinition>;
}

export interface Epic {
  id: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
}

// types/navigation.ts
export type ViewLevel = 'l0' | 'l1' | 'l2' | 'l3';
export type DashboardMode = 'cascade' | 'bead';

export interface NavigationState {
  currentView: ViewLevel;
  selectedL1: string | null;
  selectedL2: string | null;
  selectedTaskId: string | null;
  mode: DashboardMode;
  epicId: string | null;
}
```

## Key Implementation Patterns

### TanStack Query Polling Hook

```typescript
// hooks/useStatus.ts
import { useQuery } from '@tanstack/react-query';
import { fetchStatus, fetchBeadStatus } from '@/lib/api';
import { useNavigation } from './useNavigation';

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
```

### Navigation Context

```typescript
// context/NavigationContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavigationState>(() => ({
    currentView: 'l0',
    selectedL1: null,
    selectedL2: null,
    selectedTaskId: null,
    mode: (typeof localStorage !== 'undefined'
      ? localStorage.getItem('dashboard-mode') as DashboardMode
      : 'cascade') || 'cascade',
    epicId: typeof localStorage !== 'undefined'
      ? localStorage.getItem('selected-epic')
      : null,
  }));

  const showView = useCallback((view: ViewLevel, l1?: string, l2?: string, taskId?: string) => {
    setState(prev => ({
      ...prev,
      currentView: view,
      selectedL1: l1 ?? null,
      selectedL2: l2 ?? null,
      selectedTaskId: taskId ?? null,
    }));
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      switch (prev.currentView) {
        case 'l3': return { ...prev, currentView: 'l2', selectedTaskId: null };
        case 'l2': return { ...prev, currentView: 'l1', selectedL2: null };
        case 'l1': return { ...prev, currentView: 'l0', selectedL1: null };
        default: return prev;
      }
    });
  }, []);

  return (
    <NavigationContext.Provider value={{ ...state, showView, goBack, setMode, setEpicId }}>
      {children}
    </NavigationContext.Provider>
  );
}
```

### Tailwind Config

```typescript
// tailwind.config.ts
const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'status-completed': '#10b981',
        'status-in-progress': '#f59e0b',
        'status-failed': '#ef4444',
        'status-pending': '#6b7280',
        'bg-primary': '#0f172a',
        'bg-secondary': '#1e293b',
        'bg-tertiary': '#334155',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'border-color': '#334155',
        'accent': '#3b82f6',
      },
    },
  },
};
```

### Next.js Config for Static Export

```javascript
// next.config.js
const nextConfig = {
  output: 'export',
  distDir: '../out',
  trailingSlash: true,
  images: { unoptimized: true },

  // Development proxy
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
    ];
  },
};
```

## Development Workflow

```bash
# Terminal 1: FastAPI backend
cd program_nova/dashboard
python -m program_nova.dashboard.server --port 8000

# Terminal 2: Next.js dev server
cd program_nova/dashboard/nextjs
npm run dev  # Runs on port 3000, proxies /api/* to :8000
```

## Production Build

```bash
cd program_nova/dashboard/nextjs
npm run build  # Outputs to ../out/

# Then run FastAPI as usual
python -m program_nova.dashboard.server
```

## Verification Checklist

- [ ] All 4 view levels (L0, L1, L2, L3) work correctly
- [ ] 1-second polling updates data in real-time
- [ ] Polling stops when all tasks complete
- [ ] Cascade and Bead modes switch correctly
- [ ] Tree view collapse/expand works
- [ ] Tree view shows correct status colors
- [ ] Dependency graph renders correctly
- [ ] Dependency graph nodes are clickable
- [ ] Log viewer auto-scrolls
- [ ] Log viewer manual refresh works
- [ ] Production build serves correctly from FastAPI
- [ ] Mobile responsive layout works
- [ ] Mode/epic selection persists in localStorage

## API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Full project status (cascade mode) |
| `/api/tasks/{task_id}` | GET | Single task details |
| `/api/tasks/{task_id}/logs` | GET | Task logs |
| `/api/beads/epics` | GET | List available epics |
| `/api/beads/start` | POST | Start epic execution |
| `/api/beads/status/{epic_id}` | GET | Epic status (bead mode) |
