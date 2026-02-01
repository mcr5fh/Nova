/**
 * WebSocket Handler - Connection management and message routing
 *
 * Handles WebSocket connections and routes messages to appropriate handlers
 */

import type { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { SessionManager } from '../sessions/manager.js';
import type {
  ClientMessage,
  ServerMessage,
  SessionMode,
  DimensionInfo,
} from './messages.js';
import { isClientMessage } from './messages.js';

export interface WebSocketHandlerConfig {
  sessionManager: SessionManager;
}

// Track which session each WebSocket is associated with
const connectionSessions = new WeakMap<WebSocket, string>();

/**
 * Send a message to a WebSocket client
 */
function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Send an error message to a WebSocket client
 */
function sendError(ws: WebSocket, message: string, code?: string): void {
  send(ws, { type: 'error', message, code });
}

/**
 * Handle start_session message
 */
async function handleStartSession(
  ws: WebSocket,
  mode: SessionMode,
  sessionManager: SessionManager,
  model?: string
): Promise<void> {
  try {
    const session = sessionManager.createSession(mode);
    connectionSessions.set(ws, session.id);

    send(ws, {
      type: 'session_started',
      sessionId: session.id,
      mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start session';
    sendError(ws, message, 'SESSION_START_FAILED');
  }
}

/**
 * Handle resume_session message
 */
async function handleResumeSession(
  ws: WebSocket,
  sessionId: string,
  sessionManager: SessionManager
): Promise<void> {
  const session = sessionManager.getSession(sessionId);

  if (!session) {
    sendError(ws, `Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    return;
  }

  connectionSessions.set(ws, sessionId);
  sessionManager.touchSession(sessionId);

  send(ws, {
    type: 'session_resumed',
    sessionId,
    mode: session.mode,
  });
}

/**
 * Handle user_message - stream response back to client
 */
async function handleUserMessage(
  ws: WebSocket,
  text: string,
  sessionManager: SessionManager
): Promise<void> {
  const sessionId = connectionSessions.get(ws);

  if (!sessionId) {
    sendError(ws, 'No active session. Send start_session first.', 'NO_SESSION');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    sendError(ws, `Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    return;
  }

  try {
    // Stream response chunks back to client
    for await (const chunk of sessionManager.chat(sessionId, text)) {
      if (chunk.type === 'text' && chunk.text) {
        send(ws, { type: 'assistant_chunk', text: chunk.text });
      } else if (chunk.type === 'done') {
        send(ws, { type: 'assistant_done' });

        // Send progress update after assistant_done
        const { dimensions, currentFocus } = sessionManager.getDimensionInfo(sessionId);
        send(ws, {
          type: 'progress_update',
          dimensions,
          currentFocus,
        });
      }
      // 'progress' type from chat() is internal; we send progress_update after done
      // 'saved' and 'loaded' are handled but we don't need special client messages
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed';
    sendError(ws, message, 'CHAT_FAILED');
  }
}

/**
 * Handle command message
 */
async function handleCommand(
  ws: WebSocket,
  cmd: string,
  args: string | undefined,
  sessionManager: SessionManager
): Promise<void> {
  const sessionId = connectionSessions.get(ws);

  if (!sessionId) {
    sendError(ws, 'No active session. Send start_session first.', 'NO_SESSION');
    return;
  }

  // Commands are handled through the chat interface with the / prefix
  const commandText = args ? `${cmd} ${args}` : cmd;

  try {
    for await (const chunk of sessionManager.chat(sessionId, commandText)) {
      if (chunk.type === 'text' && chunk.text) {
        // For export command, send as export_ready
        if (cmd === '/export') {
          send(ws, {
            type: 'export_ready',
            format: args || 'markdown',
            data: chunk.text,
          });
        } else {
          send(ws, { type: 'assistant_chunk', text: chunk.text });
        }
      } else if (chunk.type === 'done') {
        send(ws, { type: 'assistant_done' });

        // Send progress update after commands too
        const { dimensions, currentFocus } = sessionManager.getDimensionInfo(sessionId);
        send(ws, {
          type: 'progress_update',
          dimensions,
          currentFocus,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Command failed';
    sendError(ws, message, 'COMMAND_FAILED');
  }
}

/**
 * Handle incoming WebSocket message
 */
async function handleMessage(
  ws: WebSocket,
  data: Buffer | ArrayBuffer | Buffer[],
  sessionManager: SessionManager
): Promise<void> {
  let message: unknown;

  try {
    const text = data.toString();
    message = JSON.parse(text);
  } catch {
    sendError(ws, 'Invalid JSON message', 'INVALID_JSON');
    return;
  }

  if (!isClientMessage(message)) {
    sendError(ws, 'Invalid message type', 'INVALID_MESSAGE');
    return;
  }

  switch (message.type) {
    case 'start_session':
      await handleStartSession(ws, message.mode, sessionManager, message.model);
      break;

    case 'resume_session':
      await handleResumeSession(ws, message.sessionId, sessionManager);
      break;

    case 'user_message':
      await handleUserMessage(ws, message.text, sessionManager);
      break;

    case 'command':
      await handleCommand(ws, message.cmd, message.args, sessionManager);
      break;

    default:
      sendError(ws, `Unknown message type`, 'UNKNOWN_MESSAGE');
  }
}

/**
 * Set up WebSocket connection handling
 */
export function setupWebSocketHandler(
  wss: WebSocketServer,
  config: WebSocketHandlerConfig
): void {
  const { sessionManager } = config;

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log(`[WebSocket] New connection from ${request.socket.remoteAddress}`);

    ws.on('message', async (data) => {
      try {
        await handleMessage(ws, data, sessionManager);
      } catch (error) {
        console.error('[WebSocket] Unhandled error:', error);
        sendError(ws, 'Internal server error', 'INTERNAL_ERROR');
      }
    });

    ws.on('close', (code, reason) => {
      const sessionId = connectionSessions.get(ws);
      console.log(
        `[WebSocket] Connection closed. Session: ${sessionId || 'none'}, Code: ${code}`
      );
      // Note: We don't remove the session on disconnect to allow resume
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });

    // Send a ping to confirm connection is alive
    ws.on('pong', () => {
      // Client responded to ping - connection is alive
    });
  });

  // Set up periodic ping to detect stale connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });
}

/**
 * Get session ID for a WebSocket connection
 */
export function getSessionIdForConnection(ws: WebSocket): string | undefined {
  return connectionSessions.get(ws);
}
