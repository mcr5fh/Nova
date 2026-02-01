import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import type { WSMessage, SessionState } from '../../shared/types';
import { SessionManager } from './session';
import { WhisperClient } from './whisper';
import { TTSClient } from './tts';
import { ClaudeClient } from './claude';
import { SpecWriter } from './spec-writer';
import {
  withRetry,
  sendErrorToClient,
  ErrorCodes,
  classifyError,
} from './error-handler';

interface ClientConnection {
  ws: WebSocket;
  clientId: string;
  sessionId: string | null;
  ttsClient: TTSClient;
}

export class WebSocketHandler {
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private sessionManager: SessionManager;
  private whisperClient: WhisperClient;
  private claudeClient: ClaudeClient;
  private specWriter: SpecWriter;
  private audioBuffers: Map<string, Buffer[]> = new Map();

  constructor(wss: WebSocketServer, sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.whisperClient = new WhisperClient();
    this.claudeClient = new ClaudeClient();
    this.specWriter = new SpecWriter();

    wss.on('connection', (ws) => this.handleConnection(ws));
  }

  private handleConnection(ws: WebSocket): void {
    // Each client gets a unique ID and their own TTS client
    const clientId = uuid();
    this.clients.set(ws, {
      ws,
      clientId,
      sessionId: null,
      ttsClient: new TTSClient(),
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        await this.handleMessage(ws, message);
      } catch {
        sendErrorToClient(ws, ErrorCodes.INVALID_MESSAGE);
      }
    });

    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client) {
        // Stop any ongoing TTS when client disconnects
        client.ttsClient.stop();
        if (client.sessionId) {
          // Release session lock
          this.sessionManager.releaseLock(client.sessionId, client.clientId);
          this.audioBuffers.delete(client.sessionId);
        }
      }
      this.clients.delete(ws);
    });
  }

  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    const client = this.clients.get(ws)!;

    switch (message.type) {
      case 'session_state':
        await this.handleSessionState(ws, client, message.payload as { sessionId?: string; slug?: string });
        break;

      case 'text_input':
        if (!client.sessionId) {
          sendErrorToClient(ws, ErrorCodes.NO_ACTIVE_SESSION);
          return;
        }
        await this.handleTextInput(ws, client, (message.payload as { text: string }).text);
        break;

      case 'audio_chunk':
        if (!client.sessionId) {
          sendErrorToClient(ws, ErrorCodes.NO_ACTIVE_SESSION);
          return;
        }
        await this.handleAudioChunk(ws, client, message.payload as { chunk: string; isLast: boolean });
        break;

      case 'stop_speaking':
        client.ttsClient.stop();
        break;

      case 'generate_spec':
        await this.handleGenerateSpec(ws, client);
        break;
    }
  }

  private async handleSessionState(
    ws: WebSocket,
    client: ClientConnection,
    payload: { sessionId?: string; slug?: string }
  ): Promise<void> {
    const { sessionId, slug } = payload;

    if (sessionId) {
      // Resume existing session
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        sendErrorToClient(ws, ErrorCodes.SESSION_NOT_FOUND);
        return;
      }

      // Check if session is locked by another client
      if (this.sessionManager.isLockedByOther(sessionId, client.clientId)) {
        sendErrorToClient(ws, ErrorCodes.SESSION_LOCKED);
        return;
      }

      // Acquire lock
      if (!this.sessionManager.acquireLock(sessionId, client.clientId)) {
        sendErrorToClient(ws, ErrorCodes.SESSION_LOCKED);
        return;
      }

      client.sessionId = sessionId;
      this.sendSessionState(ws, session);
    } else if (slug) {
      // Create new session
      const session = await this.sessionManager.createSession(slug);
      // Acquire lock for new session
      this.sessionManager.acquireLock(session.id, client.clientId);
      client.sessionId = session.id;
      this.sendSessionState(ws, session);
    }
  }

  private async handleGenerateSpec(
    ws: WebSocket,
    client: ClientConnection
  ): Promise<void> {
    if (!client.sessionId) {
      sendErrorToClient(ws, ErrorCodes.NO_ACTIVE_SESSION);
      return;
    }

    const session = await this.sessionManager.getSession(client.sessionId);
    if (!session) {
      sendErrorToClient(ws, ErrorCodes.SESSION_NOT_FOUND);
      return;
    }

    let specContent: string;
    let specPath: string;

    // Generate spec using Claude with retry
    try {
      specContent = await withRetry(
        () => this.claudeClient.generateSpec(session),
        3,
        1000
      );
    } catch (error) {
      console.error('Spec generation error:', error);
      const apiError = classifyError(error, ErrorCodes.CLAUDE_ERROR);
      sendErrorToClient(ws, ErrorCodes.CLAUDE_ERROR, apiError.message);
      return;
    }

    // Save spec to disk with retry
    try {
      specPath = await withRetry(
        () => this.specWriter.saveSpec(session.slug, specContent),
        3,
        1000
      );
    } catch (error) {
      console.error('Spec save error:', error);
      // Even if save fails, we can still send the content to the client
      // so they don't lose their work
      this.send(ws, {
        type: 'spec_generated',
        payload: {
          path: null,
          content: specContent,
          saveError: 'Failed to save spec to disk. Content shown below for manual saving.',
        },
        timestamp: Date.now(),
      });
      return;
    }

    // Notify client of success
    this.send(ws, {
      type: 'spec_generated',
      payload: { path: specPath, content: specContent },
      timestamp: Date.now(),
    });

    // Update session phase to complete
    await this.sessionManager.updateSession(client.sessionId, {
      currentPhase: 'complete',
    });
  }

  private async handleAudioChunk(
    ws: WebSocket,
    client: ClientConnection,
    payload: { chunk: string; isLast: boolean }
  ): Promise<void> {
    const sessionId = client.sessionId!;
    const chunk = Buffer.from(payload.chunk, 'base64');

    // Auto-pause TTS when user starts recording (edge case: concurrent audio)
    if (client.ttsClient.isActive()) {
      client.ttsClient.stop();
    }

    // Accumulate audio chunks
    if (!this.audioBuffers.has(sessionId)) {
      this.audioBuffers.set(sessionId, []);
    }
    this.audioBuffers.get(sessionId)!.push(chunk);

    if (payload.isLast) {
      // Transcribe accumulated audio
      const chunks = this.audioBuffers.get(sessionId)!;
      this.audioBuffers.delete(sessionId);

      try {
        const transcript = await withRetry(
          () => this.whisperClient.transcribeStream(chunks),
          2,
          500
        );

        // Send transcript to client
        this.send(ws, {
          type: 'transcript_update',
          payload: { text: transcript, source: 'voice' },
          timestamp: Date.now(),
        });

        // Process as text input
        await this.handleTextInput(ws, client, transcript);
      } catch (error) {
        console.error('Whisper transcription error:', error);
        sendErrorToClient(
          ws,
          ErrorCodes.WHISPER_ERROR,
          undefined,
          'text-input' // Hint to use text fallback
        );
      }
    }
  }

  private async handleTextInput(
    ws: WebSocket,
    client: ClientConnection,
    text: string
  ): Promise<void> {
    const session = await this.sessionManager.getSession(client.sessionId!);
    if (!session) {
      sendErrorToClient(ws, ErrorCodes.SESSION_NOT_FOUND);
      return;
    }

    // Add user message to history
    session.conversationHistory.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    });

    try {
      // Get AI response from Claude with retry
      const { response: responseText, shouldGenerate } = await withRetry(
        () => this.claudeClient.chat(session, text),
        2,
        1000
      );

      // Add assistant message to history
      session.conversationHistory.push({
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
      });

      // Update session
      await this.sessionManager.updateSession(client.sessionId!, {
        conversationHistory: session.conversationHistory,
      });

      // Send AI response to client
      await this.sendAIResponse(ws, client, responseText, shouldGenerate);
    } catch (error) {
      console.error('Claude API error:', error);
      sendErrorToClient(ws, ErrorCodes.CLAUDE_ERROR);
    }
  }

  private async sendAIResponse(
    ws: WebSocket,
    client: ClientConnection,
    text: string,
    shouldGenerate: boolean
  ): Promise<void> {
    // Send text first (this always works)
    this.send(ws, {
      type: 'ai_response',
      payload: { text, shouldGenerate },
      timestamp: Date.now(),
    });

    // Stream TTS audio - failure is acceptable since text was already sent
    try {
      await client.ttsClient.synthesizeStreaming(text, (audioChunk) => {
        this.send(ws, {
          type: 'ai_audio',
          payload: { chunk: audioChunk.toString('base64') },
          timestamp: Date.now(),
        });
      });
    } catch (error) {
      // TTS failed, but text was already sent - this is acceptable fallback
      // Notify client that voice response is unavailable
      console.error('TTS synthesis failed:', error);
      sendErrorToClient(
        ws,
        ErrorCodes.TTS_ERROR,
        undefined,
        'text-only' // Hint that we're in text-only mode
      );
    }
  }

  private sendSessionState(ws: WebSocket, session: SessionState): void {
    this.send(ws, { type: 'session_state', payload: session, timestamp: Date.now() });
  }

  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
