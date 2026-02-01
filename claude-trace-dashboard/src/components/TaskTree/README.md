# TaskTree Component

A React component for visualizing task hierarchies with both static (Mermaid) and interactive (React Flow) views.

## Features

- **Dual View Modes**:
  - **Mermaid Static Diagram**: Clean, printable diagrams using Mermaid syntax
  - **React Flow Interactive Graph**: Zoom, pan, click, and hover interactions

- **Visual Status Indicators**:
  - 🟢 Green: Closed/Complete
  - 🟡 Yellow: In Progress
  - 🔴 Red: Blocked
  - ⚪ Gray: Open

- **Task Type Icons**:
  - 📦 Epic
  - ✨ Feature
  - 🐛 Bug
  - 📋 Task

- **Automatic Layout**: Uses ELK algorithm for optimal graph positioning
- **Dependency Visualization**: Dashed lines show task dependencies
- **Parent-Child Relationships**: Solid lines show hierarchical structure
- **Interactive Controls**: Minimap, zoom controls, and pan in Flow view

## Usage

```tsx
import { TaskTree, TaskNode } from '@/components/TaskTree';

const tasks: TaskNode[] = [
  {
    id: 'Nova-123',
    title: 'Example Task',
    type: 'task',
    status: 'in_progress',
    priority: 2,
    assignee: 'Developer',
    created: '2026-01-31',
    updated: '2026-01-31',
    children: [
      {
        id: 'Nova-124',
        title: 'Subtask',
        type: 'task',
        status: 'open',
        priority: 2,
        created: '2026-01-31',
        updated: '2026-01-31',
        parentId: 'Nova-123',
      }
    ],
  }
];

function MyComponent() {
  const handleTaskClick = (taskId: string) => {
    console.log('Clicked:', taskId);
  };

  const handleTaskHover = (taskId: string | null) => {
    console.log('Hovering:', taskId);
  };

  return (
    <TaskTree
      tasks={tasks}
      initialView="flow"
      onTaskClick={handleTaskClick}
      onTaskHover={handleTaskHover}
    />
  );
}
```

## Props

### TaskTree

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tasks` | `TaskNode[]` | required | Array of task nodes to visualize |
| `initialView` | `'mermaid' \| 'flow'` | `'flow'` | Initial view mode |
| `onTaskClick` | `(taskId: string) => void` | optional | Called when a task is clicked |
| `onTaskHover` | `(taskId: string \| null) => void` | optional | Called when hovering over a task |

### TaskNode

```typescript
interface TaskNode {
  id: string;                    // Unique task identifier (e.g., 'Nova-123')
  title: string;                 // Task title/description
  type: 'task' | 'bug' | 'feature' | 'epic';
  status: 'open' | 'in_progress' | 'closed' | 'blocked';
  priority: 0 | 1 | 2 | 3 | 4;  // 0=critical, 4=backlog
  assignee?: string;             // Optional assignee name
  created: string;               // Creation date (ISO format)
  updated: string;               // Last update date (ISO format)
  description?: string;          // Detailed description
  notes?: string;                // Additional notes
  design?: string;               // Design notes
  parentId?: string;             // Parent task ID
  children?: TaskNode[];         // Child tasks
  dependsOn?: string[];          // Task IDs this depends on
  blocks?: string[];             // Task IDs this blocks
}
```

## Components

### TaskTree
Main container component with view toggle controls.

### MermaidView
Renders a static Mermaid diagram. Best for:
- Screenshots and documentation
- Print-friendly views
- Simple hierarchies

### FlowView
Renders an interactive React Flow graph. Best for:
- Large task trees
- Exploring dependencies
- Interactive analysis

### TaskNodeComponent
Custom node component for React Flow, displaying:
- Task ID and title
- Status badge with color
- Priority level
- Assignee (if present)

## Styling

Components use Tailwind CSS classes and support dark mode by default. The color scheme follows the project's design system:
- Background: `bg-slate-800`
- Text: `text-white`, `text-slate-400`
- Borders: `border-slate-700`
- Status colors: green-500, yellow-500, red-500, slate-400

## Performance

- ELK layout runs asynchronously to avoid blocking UI
- Large graphs (100+ nodes) may take a few seconds to layout
- Mermaid rendering is cached by the library
- React Flow uses virtualization for large graphs

## Dependencies

- `mermaid`: Static diagram rendering
- `@xyflow/react`: Interactive graph rendering
- `elkjs`: Automatic graph layout algorithm

## Testing

Run the demo to see the component in action:
```bash
npm run dev
```

The demo includes sample task data and demonstrates all features.
