/**
 * Nova Server - WebSocket server for voice interface
 *
 * Entry point for the nova-server package
 */

import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { SessionManager } from './sessions/manager.js';
import { setupWebSocketHandler } from './websocket/handler.js';

// Re-export types for consumers
export type {
  ClientMessage,
  ServerMessage,
  SessionMode,
  DimensionInfo,
  StartSessionMessage,
  ResumeSessionMessage,
  UserMessageMessage,
  CommandMessage,
  SessionStartedMessage,
  SessionResumedMessage,
  AssistantChunkMessage,
  AssistantDoneMessage,
  ProgressUpdateMessage,
  ExportReadyMessage,
  ErrorMessage,
} from './websocket/messages.js';

export { SessionManager } from './sessions/manager.js';
export type { ManagedSession, SessionManagerConfig } from './sessions/manager.js';
export { setupWebSocketHandler, getSessionIdForConnection } from './websocket/handler.js';

export interface NovaServerConfig {
  port?: number;
  host?: string;
  apiKey?: string;
  modelId?: string;
  basePath?: string;
  enableHealthCheck?: boolean;
}

export interface NovaServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  getPort(): number;
  getSessionManager(): SessionManager;
}

/**
 * Create a Nova WebSocket server
 */
export function createNovaServer(config: NovaServerConfig = {}): NovaServer {
  const port = config.port || parseInt(process.env.NOVA_PORT || '3001', 10);
  const host = config.host || process.env.NOVA_HOST || '0.0.0.0';
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  const modelId = config.modelId || process.env.NOVA_MODEL || 'claude-sonnet-4-20250514';
  const basePath = config.basePath || process.env.NOVA_BASE_PATH || process.cwd();
  const enableHealthCheck = config.enableHealthCheck ?? true;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable or apiKey config is required');
  }

  // Create session manager
  const sessionManager = new SessionManager({
    apiKey,
    modelId,
    basePath,
  });

  // Create Express app for health check
  const app = express();

  if (enableHealthCheck) {
    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeSessions: sessionManager.getActiveSessionIds().length,
      });
    });

    app.get('/sessions', (_req, res) => {
      res.json({
        sessions: sessionManager.getActiveSessionIds(),
      });
    });
  }

  // Create HTTP server
  const server = createServer(app);

  // Create WebSocket server attached to HTTP server
  const wss = new WebSocketServer({ server });

  // Set up WebSocket handling
  setupWebSocketHandler(wss, { sessionManager });

  // Set up periodic session cleanup (every 10 minutes)
  let cleanupInterval: NodeJS.Timeout | null = null;

  return {
    async start(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, host, () => {
          console.log(`[Nova Server] WebSocket server listening on ws://${host}:${port}`);
          if (enableHealthCheck) {
            console.log(`[Nova Server] Health check available at http://${host}:${port}/health`);
          }

          // Start cleanup interval
          cleanupInterval = setInterval(() => {
            const removed = sessionManager.cleanupStaleSessions();
            if (removed > 0) {
              console.log(`[Nova Server] Cleaned up ${removed} stale sessions`);
            }
          }, 10 * 60 * 1000);

          resolve();
        });
      });
    },

    async stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (cleanupInterval) {
          clearInterval(cleanupInterval);
          cleanupInterval = null;
        }

        // Close all WebSocket connections
        wss.clients.forEach((client) => {
          client.close(1001, 'Server shutting down');
        });

        wss.close((err) => {
          if (err) {
            console.error('[Nova Server] Error closing WebSocket server:', err);
          }

          server.close((err) => {
            if (err) {
              reject(err);
            } else {
              console.log('[Nova Server] Server stopped');
              resolve();
            }
          });
        });
      });
    },

    getPort(): number {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        return addr.port;
      }
      return port;
    },

    getSessionManager(): SessionManager {
      return sessionManager;
    },
  };
}

// Run as CLI if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const server = createNovaServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Nova Server] Received SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Nova Server] Received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  server.start().catch((err) => {
    console.error('[Nova Server] Failed to start:', err);
    process.exit(1);
  });
}
