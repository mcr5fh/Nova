# WebSocket Proxy Configuration

This document explains how the WebSocket proxy is configured for the agent chat feature in the Next.js dashboard.

## Overview

The dashboard uses WebSocket connections to communicate with the agent chat loop server. During development, Next.js can proxy WebSocket requests to the backend server. In production (static export), the client connects directly to the WebSocket server.

## Configuration

### Environment Variables

Create a `.env.local` file (not committed to git) based on `.env.example`:

```bash
# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:8001
AGENT_LOOP_PORT=8001
```

**Environment Variables:**

- `NEXT_PUBLIC_WS_URL` (client-side): The full WebSocket URL the browser will connect to
  - Default: `ws://localhost:8001`
  - Production example: `wss://example.com/agent`
  - Must start with `ws://` or `wss://`

- `AGENT_LOOP_PORT` (server-side): Port for the development proxy
  - Default: `8001`
  - Used only during `npm run dev` (not in production build)

### Development Mode

During development (`npm run dev`), Next.js rewrites `/ws` requests to the agent loop server:

```typescript
// next.config.ts
{
  source: '/ws',
  destination: 'http://localhost:8001/ws'
}
```

This allows the frontend to connect to `ws://localhost:3000/ws` which gets proxied to `ws://localhost:8001/ws`.

### Production Mode

In production (static export), the proxy does not work. The client must connect directly to the WebSocket server using `NEXT_PUBLIC_WS_URL`.

## Usage in Code

Import the WebSocket configuration:

```typescript
import { getWebSocketUrl, WS_CONFIG } from '@/config/websocket';

// Option 1: Use the helper function
const wsUrl = getWebSocketUrl(); // Returns "ws://localhost:8001/ws"

// Option 2: Use the config object
const wsUrl = WS_CONFIG.fullUrl; // Returns "ws://localhost:8001/ws"
```

## Testing

Run the WebSocket configuration tests:

```bash
npm test -- next.config.test.ts
npm test -- src/config/websocket.test.ts
```

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Browser   │         │  Next.js Dev │         │  Agent Loop     │
│             │ ───────>│   Server     │ ───────>│  Server         │
│ ws://...    │  /ws    │  (Port 3000) │ proxy   │  (Port 8001)    │
└─────────────┘         └──────────────┘         └─────────────────┘
   Development

┌─────────────┐                                   ┌─────────────────┐
│   Browser   │                                   │  Agent Loop     │
│             │ ─────────────────────────────────>│  Server         │
│ ws://...    │         Direct connection         │  (Port 8001)    │
└─────────────┘                                   └─────────────────┘
   Production
```

## Related Files

- `next.config.ts` - WebSocket proxy configuration
- `src/config/websocket.ts` - WebSocket URL configuration module
- `.env.example` - Example environment variables
- `docs/AGENT_CHAT_WS_API.md` - WebSocket API specification
