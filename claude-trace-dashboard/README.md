# Claude Trace Dashboard

A React + TypeScript dashboard for visualizing Claude Code traces in real-time.

## Tech Stack

- **React 19** - Server Components, useOptimistic, use() hook
- **TypeScript 5.7+** - Strict mode, type-safe APIs
- **Vite 6** - Fast dev server, HMR
- **Tailwind CSS 4** - Utility-first styling with @theme directive
- **TanStack Query v5** - Server state, caching, real-time sync
- **TanStack Table v8** - Trace event tables
- **Zustand** - Client state management
- **Mermaid.js 11.12+** - Task hierarchy diagrams
- **Recharts** - Cost/token analytics charts
- **React Flow** - Interactive task graph

## Project Structure

```
claude-trace-dashboard/
├── src/
│   ├── api/              # API client, hooks, SSE
│   ├── components/       # React components
│   │   ├── TaskTree/
│   │   ├── Timeline/
│   │   ├── Analytics/
│   │   ├── TraceTable/
│   │   └── Layout/
│   ├── pages/           # Page components
│   ├── stores/          # Zustand stores
│   ├── types/           # TypeScript types
│   ├── lib/             # Utility functions
│   └── data/            # Mock data
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
# → http://localhost:3000
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Configuration

### Path Aliases

The project uses `@/*` path aliases for cleaner imports:

```typescript
import { api } from '@/api/client';
import { TaskTree } from '@/components/TaskTree/TaskTree';
```

### API Proxy

The dev server proxies `/api` requests to `http://localhost:8080`:

```typescript
// Automatically proxied in development
fetch('/api/traces');
```

## Design System

### Typography

- **Primary Font:** Sora (clean, technical)
- **Mono Font:** IBM Plex Mono (IDs, payloads, timestamps)
- **Type Scale:** 12px (meta), 13px (table), 14px (body), 16px (section), 20px (card title), 28px (page title)

### Colors

Available via CSS variables:

- `--color-bg-0`, `--color-bg-1` - Background colors
- `--color-card` - Card background
- `--color-text-0`, `--color-text-1`, `--color-text-2` - Text colors
- `--color-border` - Border color
- `--color-accent`, `--color-accent-2` - Accent colors
- `--color-status-green`, `--color-status-amber`, `--color-status-red`, `--color-status-gray` - Status colors

## Next Steps

See the [Frontend Specification](../thoughts/shared/specs/claude-trace/04-frontend-specification.md) for implementation details.
