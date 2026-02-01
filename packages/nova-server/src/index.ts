/**
 * Nova Server - WebSocket server for voice interface
 *
 * Entry point for the nova-server package
 */

import 'dotenv/config';
import { WebSocketServer } from 'ws';
import express from 'express';
import { createServer } from 'http';
import multer from 'multer';
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
  openaiApiKey?: string;
  modelId?: string;
  basePath?: string;
  enableHealthCheck?: boolean;
  enableTTSProxy?: boolean;
  corsOrigin?: string;
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
  const openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  const modelId = config.modelId || process.env.NOVA_MODEL || 'claude-sonnet-4-20250514';
  const basePath = config.basePath || process.env.NOVA_BASE_PATH || process.cwd();
  const enableHealthCheck = config.enableHealthCheck ?? true;
  const enableTTSProxy = config.enableTTSProxy ?? !!openaiApiKey;
  const corsOrigin = config.corsOrigin || process.env.NOVA_CORS_ORIGIN || '*';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable or apiKey config is required');
  }

  // Create session manager
  const sessionManager = new SessionManager({
    apiKey,
    modelId,
    basePath,
  });

  // Create Express app for health check and API endpoints
  const app = express();

  // Enable CORS for frontend
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Parse JSON bodies for TTS endpoint
  app.use(express.json());

  // Configure multer for audio file uploads (memory storage for small audio clips)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB max (OpenAI Whisper limit)
    },
  });

  if (enableHealthCheck) {
    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeSessions: sessionManager.getActiveSessionIds().length,
        ttsEnabled: enableTTSProxy,
      });
    });

    app.get('/sessions', (_req, res) => {
      res.json({
        sessions: sessionManager.getActiveSessionIds(),
      });
    });
  }

  // TTS proxy endpoint - proxies requests to OpenAI TTS API
  if (enableTTSProxy && openaiApiKey) {
    app.post('/api/tts', async (req, res) => {
      const { text, voice = 'nova', model = 'tts-1', speed = 1.0 } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Missing or invalid "text" field' });
        return;
      }

      try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: text,
            voice,
            speed,
            response_format: 'mp3',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[TTS Proxy] OpenAI error:', response.status, errorText);
          res.status(response.status).json({ error: `OpenAI TTS error: ${response.status}` });
          return;
        }

        // Stream the audio response back to client
        res.setHeader('Content-Type', 'audio/mpeg');
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      } catch (error) {
        console.error('[TTS Proxy] Error:', error);
        res.status(500).json({ error: 'TTS proxy error' });
      }
    });

    console.log('[Nova Server] TTS proxy enabled at /api/tts');

    // Transcription endpoint - proxies requests to OpenAI Whisper API
    app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
      const file = req.file;
      const language = (req.body.language as string) || 'en';
      const model = (req.body.model as string) || 'whisper-1';

      if (!file) {
        res.status(400).json({ error: 'Missing audio file' });
        return;
      }

      try {
        // Create FormData for OpenAI API
        const formData = new FormData();

        // OpenAI expects a File or Blob with a filename
        const blob = new Blob([file.buffer], { type: file.mimetype });
        formData.append('file', blob, file.originalname || 'audio.webm');
        formData.append('model', model);
        formData.append('language', language);
        formData.append('response_format', 'json');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Transcribe] OpenAI error:', response.status, errorText);
          res.status(response.status).json({ error: `OpenAI Whisper error: ${response.status}` });
          return;
        }

        const result = await response.json() as { text: string; language?: string };
        res.json({
          text: result.text,
          language: result.language || language,
        });
      } catch (error) {
        console.error('[Transcribe] Error:', error);
        res.status(500).json({ error: 'Transcription error' });
      }
    });

    console.log('[Nova Server] Transcription endpoint enabled at /api/transcribe');
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
          if (enableTTSProxy && openaiApiKey) {
            console.log(`[Nova Server] TTS proxy available at http://${host}:${port}/api/tts`);
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
