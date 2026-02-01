# Claude Trace Dashboard - Complete Rewrite Implementation Plan

## Overview

Rewrite the Claude Trace Dashboard from scratch with a modern tech stack focused on the node visualizer (TaskTree graph) as the primary UI element.

## Current State Analysis

**Existing codebase issues:**

- Demo components stacked vertically without proper routing
- TaskTree graph constrained to 600px in dark container that clashes with light theme
- Dated visual design: single shadow value, basic borders, no dark mode
- No UI component library - components built from scratch
- React Router installed but not implemented
- Mixed theme inconsistencies (light app, dark graph)

**What we're keeping:**

- React Flow + ELK.js for graph visualization (works well)
- Core TaskNode data structure
- API client structure (if it exists)
- Vite + TypeScript + React 19 setup

**What we're deleting:**

- All demo wrappers (AnalyticsDemo, TaskTreeDemo, TraceTable demos)
- Custom-built UI components (Header, Sidebar, Layout)
- Current styling approach (minimal shadows, basic borders)
- Hardcoded dark/light theme mixing

## Desired End State

A modern, production-ready dashboard with:

- **Primary UI**: Full-viewport TaskTree graph visualization
- **Component library**: shadcn/ui for all UI components
- **Design**: Dark-first with glassmorphism, modern shadows, spring animations
- **Routing**: Proper React Router implementation
- **Scalability**: Clean architecture for adding analytics/timeline views later

### Success Criteria

#### Automated Verification

- [ ] Type checking passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Dev server starts: `npm run dev`
- [ ] All new components render without errors

#### Manual Verification

- [ ] TaskTree graph fills viewport and is the primary UI element
- [ ] Graph is interactive: zoom, pan, click nodes
- [ ] Modern visual design (dark mode, glassmorphism, shadows)
- [ ] Navigation works (routing between views)
- [ ] UI is responsive (desktop + mobile)
- [ ] No theme clashing (consistent dark theme)

## What We're NOT Doing

- Analytics charts (CostChart, TokenChart, ToolUsage) - add later
- TraceTable component - add later
- Session views - add later
- Real-time SSE streaming (can add back later)
- Mermaid diagram view (React Flow only initially)

## Implementation Approach

**Delete and rebuild strategy:**

1. Delete entire `claude-trace-dashboard` directory
2. Scaffold new Vite + React + TypeScript project
3. Install shadcn/ui and configure
4. Build minimal layout (Header + main content area)
5. Rebuild TaskTree graph as primary UI
6. Add modern design system (dark mode, glassmorphism)
7. Implement basic routing structure

## Phase 1: Project Scaffolding & Setup

### Overview

Create a new React project from scratch with modern tooling and shadcn/ui.

### Changes Required

#### 1. Delete and Create New Project

**Location**: `claude-trace-dashboard/`
**Changes**: Complete replacement

```bash
# Delete existing dashboard
rm -rf claude-trace-dashboard

# Create new Vite + React + TypeScript project
npm create vite@latest claude-trace-dashboard -- --template react-ts
cd claude-trace-dashboard
npm install
```text

#### 2. Install Core Dependencies

**File**: `claude-trace-dashboard/package.json`
**Changes**: Add required dependencies

```bash
# UI and routing
npm install react-router-dom zustand @tanstack/react-query

# Graph visualization
npm install @xyflow/react elkjs

# Tailwind v4 + shadcn/ui dependencies
npm install -D tailwindcss@next @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-slot

# Icons (for shadcn components)
npm install lucide-react
```text

#### 3. Configure Vite

**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
});
```text

#### 4. Configure TypeScript

**File**: `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```text

**File**: `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```text

#### 5. Initialize shadcn/ui

**Command**: Initialize shadcn

```bash
npx shadcn@latest init -y
```text

When prompted:

- Style: New York
- Base color: Slate
- CSS variables: Yes
- Would you like to use React Server Components: No
- Install dependencies: Yes

This will create:

- `components.json` (shadcn config)
- `src/lib/utils.ts` (utility functions)
- Update `src/index.css` with Tailwind v4 config

#### 6. Configure Tailwind CSS v4

**File**: `src/index.css`

```css
@import "tailwindcss";

@theme {
  /* Dark-first color system */
  --color-bg-0: #0a0a0a;
  --color-bg-1: #111111;
  --color-bg-2: #1a1a1a;

  --color-card: rgba(255, 255, 255, 0.05);
  --color-card-hover: rgba(255, 255, 255, 0.08);

  --color-text-0: #ffffff;
  --color-text-1: #e2e8f0;
  --color-text-2: #94a3b8;
  --color-text-3: #64748b;

  --color-border: rgba(255, 255, 255, 0.1);
  --color-border-hover: rgba(255, 255, 255, 0.2);

  --color-accent: #06b6d4; /* Cyan */
  --color-accent-hover: #0891b2;

  /* Status colors */
  --color-status-green: #10b981;
  --color-status-amber: #f59e0b;
  --color-status-red: #ef4444;
  --color-status-blue: #3b82f6;

  /* Modern elevation system (5 levels) */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.25);
  --shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.3);

  /* Glassmorphism */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  --backdrop-blur: blur(10px);

  /* Fonts */
  --font-family-sans: "Inter", ui-sans-serif, system-ui;
  --font-family-mono: "JetBrains Mono", ui-monospace;
}

/* Glassmorphism utility classes */
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--glass-border);
}

/* Smooth transitions */
* {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```text

### Success Criteria

#### Automated Verification

- [ ] Project builds: `npm run build`
- [ ] Dev server starts: `npm run dev`
- [ ] TypeScript compiles: `npm run type-check`
- [ ] shadcn CLI works: `npx shadcn@latest add button`

#### Manual Verification

- [ ] Can add shadcn components successfully
- [ ] Tailwind v4 classes work in components
- [ ] Dark theme is applied globally
- [ ] Path aliases (@/) resolve correctly

---

## Phase 2: Core Layout & Routing

### Overview

Build the minimal layout shell and implement React Router for navigation.

### Changes Required

#### 1. Install shadcn Components

**Commands**: Add required shadcn components

```bash
# Core UI components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add badge
npx shadcn@latest add tooltip
npx shadcn@latest add separator
```text

This creates:

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/separator.tsx`

#### 2. Create Layout Component

**File**: `src/components/layout/app-layout.tsx`

```typescript
import { Outlet } from 'react-router-dom';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-0 text-text-0">
      <Header />
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```text

#### 3. Create Header Component

**File**: `src/components/layout/header.tsx`

```typescript
import { Activity } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 border-b border-border glass sticky top-0 z-50">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-accent" />
          <h1 className="text-xl font-semibold">Claude Trace</h1>
        </div>

        {/* Future: Add status indicator, settings, etc */}
      </div>
    </header>
  );
}
```text

#### 4. Create Sidebar Component

**File**: `src/components/layout/sidebar.tsx`

```typescript
import { Link, useLocation } from 'react-router-dom';
import { Home, GitBranch, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: GitBranch },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-border bg-bg-1">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```text

#### 5. Setup Routing

**File**: `src/main.tsx`

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
```text

**File**: `src/App.tsx`

```typescript
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardPage } from '@/pages/dashboard';
import { TasksPage } from '@/pages/tasks';
import { SettingsPage } from '@/pages/settings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
```text

#### 6. Create Placeholder Pages

**File**: `src/pages/dashboard.tsx`

```typescript
export function DashboardPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <p className="text-text-2">Task tree graph will go here</p>
    </div>
  );
}
```text

**File**: `src/pages/tasks.tsx`

```typescript
export function TasksPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Tasks</h2>
      <p className="text-text-2">Future: Task list view</p>
    </div>
  );
}
```text

**File**: `src/pages/settings.tsx`

```typescript
export function SettingsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <p className="text-text-2">Future: Settings panel</p>
    </div>
  );
}
```text

### Success Criteria

#### Automated Verification

- [ ] App builds without errors: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] All imports resolve correctly

#### Manual Verification

- [ ] Navigation works (clicking sidebar items changes route)
- [ ] Header displays correctly with logo
- [ ] Sidebar highlights active route
- [ ] Layout is responsive (sidebar + main content)
- [ ] Dark theme is consistent across all components

---

## Phase 3: TaskTree Graph Component

### Overview

Rebuild the TaskTree graph visualization as a modern, full-viewport component.

### Changes Required

#### 1. Create Type Definitions

**File**: `src/types/task.ts`

```typescript
export type TaskStatus = 'open' | 'in_progress' | 'closed' | 'blocked';
export type TaskType = 'task' | 'bug' | 'feature' | 'epic';
export type Priority = 0 | 1 | 2 | 3 | 4;

export interface TaskNode {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  assignee?: string;
  created: string;
  updated: string;
  description?: string;
  parentId?: string;
  children?: TaskNode[];
  dependsOn?: string[];
  blocks?: string[];
}
```text

#### 2. Create Task Node Component

**File**: `src/components/task-graph/task-node.tsx`

```typescript
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { TaskNode } from '@/types/task';
import { getStatusColor, getStatusIcon, getTypeIcon } from '@/lib/task-utils';

interface TaskNodeData {
  task: TaskNode;
}

export const TaskNodeComponent = memo(({ data }: NodeProps<TaskNodeData>) => {
  const { task } = data;
  const statusColor = getStatusColor(task.status);
  const StatusIcon = getStatusIcon(task.status);
  const TypeIcon = getTypeIcon(task.type);

  return (
    <div className="glass rounded-lg border-2 border-border hover:border-border-hover transition-all duration-200 min-w-[240px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-4 h-4 text-text-2" />
            <Badge variant="outline" className="text-xs">
              {task.type}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <StatusIcon className="w-4 h-4" style={{ color: statusColor }} />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-text-0 mb-1 line-clamp-2">
          {task.title}
        </h3>

        {/* ID */}
        <p className="text-xs text-text-3 font-mono">{task.id}</p>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-xs text-text-2">
          <span>P{task.priority}</span>
          {task.children && task.children.length > 0 && (
            <span>{task.children.length} subtasks</span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});

TaskNodeComponent.displayName = 'TaskNodeComponent';
```text

#### 3. Create Task Utilities

**File**: `src/lib/task-utils.ts`

```typescript
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Bug,
  Wrench,
  Sparkles,
  Layers
} from 'lucide-react';
import { TaskStatus, TaskType, TaskNode } from '@/types/task';

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'closed':
      return 'var(--color-status-green)';
    case 'in_progress':
      return 'var(--color-status-blue)';
    case 'blocked':
      return 'var(--color-status-red)';
    case 'open':
    default:
      return 'var(--color-text-2)';
  }
}

export function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case 'closed':
      return CheckCircle2;
    case 'in_progress':
      return Clock;
    case 'blocked':
      return AlertCircle;
    case 'open':
    default:
      return Circle;
  }
}

export function getTypeIcon(type: TaskType) {
  switch (type) {
    case 'bug':
      return Bug;
    case 'feature':
      return Sparkles;
    case 'epic':
      return Layers;
    case 'task':
    default:
      return Wrench;
  }
}

export function flattenTaskTree(tasks: TaskNode[]): TaskNode[] {
  const flat: TaskNode[] = [];

  function traverse(node: TaskNode) {
    flat.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  tasks.forEach(traverse);
  return flat;
}
```text

#### 4. Create Task Graph Component

**File**: `src/components/task-graph/task-graph.tsx`

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { TaskNode } from '@/types/task';
import { TaskNodeComponent } from './task-node';
import { flattenTaskTree, getStatusColor } from '@/lib/task-utils';

const elk = new ELK();

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.spacing.nodeNode': '100',
  'elk.direction': 'DOWN',
};

interface TaskGraphProps {
  tasks: TaskNode[];
  onTaskClick?: (taskId: string) => void;
}

async function layoutTasks(tasks: TaskNode[]): Promise<{
  nodes: Node[];
  edges: Edge[];
}> {
  const flatTasks = flattenTaskTree(tasks);
  const nodeMap = new Map(flatTasks.map(t => [t.id, t]));

  // Build ELK graph
  const elkNodes = flatTasks.map(task => ({
    id: task.id,
    width: 260,
    height: 120,
  }));

  const elkEdges: { id: string; sources: string[]; targets: string[] }[] = [];

  flatTasks.forEach(task => {
    if (task.children) {
      task.children.forEach(child => {
        elkEdges.push({
          id: `${task.id}-${child.id}`,
          sources: [task.id],
          targets: [child.id],
        });
      });
    }

    if (task.dependsOn) {
      task.dependsOn.forEach(depId => {
        elkEdges.push({
          id: `dep-${depId}-${task.id}`,
          sources: [depId],
          targets: [task.id],
        });
      });
    }
  });

  // Run ELK layout
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: elkOptions,
    children: elkNodes,
    edges: elkEdges,
  });

  // Convert to React Flow nodes
  const nodes: Node[] = (graph.children || []).map(node => {
    const task = nodeMap.get(node.id)!;
    return {
      id: node.id,
      type: 'taskNode',
      position: { x: node.x || 0, y: node.y || 0 },
      data: { task },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  // Convert to React Flow edges
  const edges: Edge[] = [];

  flatTasks.forEach(task => {
    if (task.children) {
      task.children.forEach(child => {
        edges.push({
          id: `${task.id}-${child.id}`,
          source: task.id,
          target: child.id,
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: 'var(--color-border)',
            strokeWidth: 2
          },
        });
      });
    }

    if (task.dependsOn) {
      task.dependsOn.forEach(depId => {
        edges.push({
          id: `dep-${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: 'var(--color-accent)',
            strokeWidth: 1.5,
            strokeDasharray: '5,5'
          },
          label: 'depends on',
          labelStyle: {
            fontSize: 11,
            fill: 'var(--color-text-2)'
          },
        });
      });
    }
  });

  return { nodes, edges };
}

export function TaskGraph({ tasks, onTaskClick }: TaskGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      taskNode: TaskNodeComponent,
    }),
    []
  );

  useEffect(() => {
    let isMounted = true;

    const doLayout = async () => {
      if (tasks.length === 0) {
        if (isMounted) {
          setNodes([]);
          setEdges([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const { nodes, edges } = await layoutTasks(tasks);
        if (isMounted) {
          setNodes(nodes);
          setEdges(edges);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Layout error:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    doLayout();

    return () => {
      isMounted = false;
    };
  }, [tasks, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onTaskClick?.(node.id);
    },
    [onTaskClick]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4" />
          <p className="text-text-2">Loading task tree...</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-2">No tasks to display</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        className="bg-bg-0"
      >
        <Background
          color="var(--color-border)"
          gap={20}
          size={1}
        />
        <Controls className="glass" />
        <MiniMap
          nodeColor={(node) => {
            const task = node.data.task as TaskNode;
            return getStatusColor(task.status);
          }}
          className="glass"
        />
      </ReactFlow>
    </div>
  );
}
```text

#### 5. Create Mock Data

**File**: `src/lib/mock-tasks.ts`

```typescript
import { TaskNode } from '@/types/task';

export const mockTasks: TaskNode[] = [
  {
    id: 'beads-001',
    title: 'Implement authentication system',
    type: 'epic',
    status: 'in_progress',
    priority: 0,
    created: '2026-01-20T10:00:00Z',
    updated: '2026-01-31T15:30:00Z',
    children: [
      {
        id: 'beads-002',
        title: 'Set up JWT token handling',
        type: 'task',
        status: 'closed',
        priority: 1,
        created: '2026-01-20T11:00:00Z',
        updated: '2026-01-25T14:00:00Z',
        parentId: 'beads-001',
      },
      {
        id: 'beads-003',
        title: 'Create login form UI',
        type: 'feature',
        status: 'in_progress',
        priority: 1,
        created: '2026-01-21T09:00:00Z',
        updated: '2026-01-31T10:00:00Z',
        parentId: 'beads-001',
        dependsOn: ['beads-002'],
      },
      {
        id: 'beads-004',
        title: 'Add password reset flow',
        type: 'feature',
        status: 'open',
        priority: 2,
        created: '2026-01-22T10:00:00Z',
        updated: '2026-01-22T10:00:00Z',
        parentId: 'beads-001',
        dependsOn: ['beads-003'],
      },
    ],
  },
  {
    id: 'beads-005',
    title: 'Fix session timeout bug',
    type: 'bug',
    status: 'blocked',
    priority: 0,
    created: '2026-01-28T14:00:00Z',
    updated: '2026-01-30T16:00:00Z',
    dependsOn: ['beads-002'],
  },
];
```text

#### 6. Update Dashboard Page

**File**: `src/pages/dashboard.tsx`

```typescript
import { TaskGraph } from '@/components/task-graph/task-graph';
import { mockTasks } from '@/lib/mock-tasks';

export function DashboardPage() {
  return (
    <div className="h-full">
      <TaskGraph
        tasks={mockTasks}
        onTaskClick={(taskId) => {
          console.log('Clicked task:', taskId);
        }}
      />
    </div>
  );
}
```text

### Success Criteria

#### Automated Verification

- [ ] TypeScript compiles: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in dev mode

#### Manual Verification

- [ ] Task graph renders and fills viewport
- [ ] Nodes display correct task information (title, type, status, priority)
- [ ] Can zoom and pan the graph
- [ ] Can click nodes (console logs task ID)
- [ ] Parent-child edges render correctly (solid lines)
- [ ] Dependency edges render correctly (dashed animated lines)
- [ ] MiniMap shows overview of graph
- [ ] Controls (zoom in/out, fit view) work
- [ ] Graph uses dark theme consistently

---

## Phase 4: Modern Design Polish

### Overview

Add modern design features: improved shadows, glassmorphism, animations, and polish.

### Changes Required

#### 1. Enhance Global Styles

**File**: `src/index.css` (additions)

```css
/* Add after @theme block */

/* Enhanced glass effects */
.glass-strong {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.glass-subtle {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Glow effects */
.glow-accent {
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
}

.glow-hover:hover {
  box-shadow: 0 0 30px rgba(6, 182, 212, 0.4);
}

/* Smooth animations */
.animate-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Spring transitions */
.spring {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-1);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}
```text

#### 2. Add Gradient Background

**File**: `src/components/layout/app-layout.tsx` (update)

```typescript
export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-0 text-text-0 relative">
      {/* Ambient gradient orbs for glassmorphism depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <Header />
        <div className="flex h-[calc(100vh-4rem)]">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
```text

#### 3. Enhance Task Node with Animations

**File**: `src/components/task-graph/task-node.tsx` (update className)

```typescript
// Update the root div className to:
<div className="glass rounded-lg border-2 border-border hover:border-accent transition-all duration-300 min-w-[240px] shadow-lg hover:shadow-xl spring hover:scale-105">
```text

#### 4. Add Loading Skeleton

**File**: `src/components/ui/skeleton.tsx` (create via shadcn)

```bash
npx shadcn@latest add skeleton
```text

**File**: `src/components/task-graph/task-graph.tsx` (update loading state)

```typescript
import { Skeleton } from '@/components/ui/skeleton';

// Replace loading JSX with:
if (isLoading) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <Skeleton className="h-12 w-12 rounded-full mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  );
}
```text

### Success Criteria

#### Automated Verification

- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No console warnings

#### Manual Verification

- [ ] Gradient background orbs visible and create depth
- [ ] Glass effects visible on header, sidebar, task nodes
- [ ] Task nodes scale on hover (spring animation)
- [ ] Task node borders glow on hover
- [ ] Loading states use skeleton components
- [ ] Scrollbars are styled consistently
- [ ] All animations are smooth (60fps)

---

## Testing Strategy

### Manual Testing Steps

1. **Navigation Testing**:
   - Click each sidebar nav item
   - Verify active state highlighting
   - Verify URL changes
   - Verify content changes

2. **Graph Interaction Testing**:
   - Zoom in/out using mouse wheel
   - Pan by dragging background
   - Click individual nodes
   - Use minimap to navigate
   - Use controls (zoom buttons, fit view)

3. **Visual Testing**:
   - Check dark theme consistency
   - Verify glassmorphism effects
   - Test hover states on all interactive elements
   - Verify animations are smooth
   - Check responsive layout (resize window)

4. **Performance Testing**:
   - Check initial load time
   - Verify graph layout performance with mock data
   - Check for memory leaks (leave open for 5 minutes)

### Edge Cases to Test

- Empty task list (no data)
- Single task (no children/dependencies)
- Deep task tree (4+ levels)
- Wide task tree (10+ siblings)
- Complex dependencies (multiple depends-on)

## Performance Considerations

- React Flow virtualizes nodes (handles large graphs efficiently)
- ELK layout runs in Web Worker (non-blocking)
- Memoized components prevent unnecessary re-renders
- shadcn components are tree-shakeable (small bundle)

## Migration Notes

### Data Migration

The existing API client structure can be preserved:

- Keep `src/api/` directory structure
- Keep `useTraces`, `useTask`, `useTaskTree` hooks
- Update types to match new TaskNode interface

### Incremental Addition of Features

After Phase 4 is complete, features can be added incrementally:

1. **Analytics charts**: Add back CostChart, TokenChart, ToolUsage
2. **Trace table**: Rebuild with shadcn Table component
3. **Session views**: Create session detail page
4. **Real-time updates**: Re-enable SSE streaming
5. **Timeline view**: Add D3-powered timeline visualization

## References

- Original research: `thoughts/shared/specs/claude-trace-dashboard/research-layout-structure.md`
- shadcn/ui docs: <https://ui.shadcn.com/docs>
- React Flow docs: <https://reactflow.dev/>
- Tailwind v4 docs: <https://tailwindcss.com/docs>
- Dark Glassmorphism article: <https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f>
