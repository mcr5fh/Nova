import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { WebSocketHandler } from './websocket';
import { SessionManager } from './session';
import { rm } from 'fs/promises';
import type { WSMessage, SessionState } from '../../shared/types';

// Mock the voice clients
vi.mock('./whisper', () => ({
  WhisperClient: class {
    transcribe = vi.fn().mockResolvedValue('Transcribed text');
    transcribeStream = vi.fn().mockResolvedValue('Transcribed text from stream');
  },
}));

vi.mock('./tts', () => ({
  TTSClient: class {
    synthesize = vi.fn().mockResolvedValue(Buffer.from('audio'));
    synthesizeStreaming = vi.fn().mockImplementation(async (text: string, onChunk: (chunk: Buffer) => void) => {
      onChunk(Buffer.from('chunk1'));
      onChunk(Buffer.from('chunk2'));
    });
    stop = vi.fn();
    isActive = vi.fn().mockReturnValue(false);
  },
}));

// Mock Claude client
vi.mock('./claude', () => ({
  ClaudeClient: class {
    chat = vi.fn().mockImplementation(async (_session: unknown, userMessage: string) => ({
      response: `Thanks for sharing: "${userMessage}". What specific problem are you trying to solve?`,
      shouldGenerate: false,
    }));
    generateSpec = vi.fn().mockResolvedValue('# Solution Specification\n\n## Summary\nGenerated spec content');
  },
}));

describe('WebSocketHandler', () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let sessionManager: SessionManager;
  let handler: WebSocketHandler;
  let port: number;

  beforeEach(async () => {
    sessionManager = new SessionManager();
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });
    handler = new WebSocketHandler(wss, sessionManager);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close connections first
    wss.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    // Give filesystem time to release handles, then clean up
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      await rm('.sessions', { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  function waitForMessage(ws: WebSocket): Promise<WSMessage> {
    return new Promise((resolve) => {
      ws.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });
  }

  function waitForMessages(ws: WebSocket, count: number): Promise<WSMessage[]> {
    return new Promise((resolve) => {
      const messages: WSMessage[] = [];
      const handler = (data: Buffer) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.length >= count) {
          ws.off('message', handler);
          resolve(messages);
        }
      };
      ws.on('message', handler);
    });
  }

  function sendMessage(ws: WebSocket, message: WSMessage): void {
    ws.send(JSON.stringify(message));
  }

  describe('session management', () => {
    it('creates a new session when requested with slug', async () => {
      const client = await createClient();
      const messagePromise = waitForMessage(client);

      sendMessage(client, {
        type: 'session_state',
        payload: { slug: 'test-feature' },
        timestamp: Date.now(),
      });

      const response = await messagePromise;

      expect(response.type).toBe('session_state');
      const session = response.payload as SessionState;
      expect(session.id).toBeDefined();
      expect(session.slug).toBe('test-feature');
      expect(session.currentPhase).toBe('gathering');

      client.close();
    });

    it('resumes existing session when requested with sessionId', async () => {
      // Create a session first
      const created = await sessionManager.createSession('test-feature');
      await sessionManager.updateSession(created.id, {
        currentPhase: 'validation',
        conversationHistory: [
          { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        ],
      });

      const client = await createClient();
      const messagePromise = waitForMessage(client);

      sendMessage(client, {
        type: 'session_state',
        payload: { sessionId: created.id },
        timestamp: Date.now(),
      });

      const response = await messagePromise;

      expect(response.type).toBe('session_state');
      const session = response.payload as SessionState;
      expect(session.id).toBe(created.id);
      expect(session.currentPhase).toBe('validation');
      expect(session.conversationHistory).toHaveLength(1);

      client.close();
    });

    it('sends error when session not found', async () => {
      const client = await createClient();
      const messagePromise = waitForMessage(client);

      sendMessage(client, {
        type: 'session_state',
        payload: { sessionId: 'non-existent-id' },
        timestamp: Date.now(),
      });

      const response = await messagePromise;

      expect(response.type).toBe('error');
      expect((response.payload as { message: string }).message).toBe('Session not found. Please start a new session.');

      client.close();
    });

    it('multiple clients can have independent sessions', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      const promise1 = waitForMessage(client1);
      const promise2 = waitForMessage(client2);

      sendMessage(client1, {
        type: 'session_state',
        payload: { slug: 'feature-one' },
        timestamp: Date.now(),
      });

      sendMessage(client2, {
        type: 'session_state',
        payload: { slug: 'feature-two' },
        timestamp: Date.now(),
      });

      const response1 = await promise1;
      const response2 = await promise2;

      const session1 = response1.payload as SessionState;
      const session2 = response2.payload as SessionState;

      expect(session1.slug).toBe('feature-one');
      expect(session2.slug).toBe('feature-two');
      expect(session1.id).not.toBe(session2.id);

      client1.close();
      client2.close();
    });
  });

  describe('text input handling', () => {
    it('sends error when no active session', async () => {
      const client = await createClient();
      const messagePromise = waitForMessage(client);

      sendMessage(client, {
        type: 'text_input',
        payload: { text: 'Hello' },
        timestamp: Date.now(),
      });

      const response = await messagePromise;

      expect(response.type).toBe('error');
      expect((response.payload as { message: string }).message).toBe('No active session. Please start a session first.');

      client.close();
    });

    it('processes text input and returns AI response with TTS audio', async () => {
      const client = await createClient();

      // First create a session
      sendMessage(client, {
        type: 'session_state',
        payload: { slug: 'test-feature' },
        timestamp: Date.now(),
      });

      await waitForMessage(client); // Wait for session_state response

      // Now send text input and wait for AI response + audio chunks
      const messagesPromise = waitForMessages(client, 3); // ai_response + 2 audio chunks

      sendMessage(client, {
        type: 'text_input',
        payload: { text: 'Hello AI' },
        timestamp: Date.now(),
      });

      const messages = await messagesPromise;

      // First message should be ai_response
      expect(messages[0].type).toBe('ai_response');
      const aiPayload = messages[0].payload as { text: string; shouldGenerate: boolean };
      expect(aiPayload.text).toContain('Thanks for sharing');
      expect(aiPayload.text).toContain('Hello AI');
      expect(aiPayload.shouldGenerate).toBe(false);

      // Following messages should be ai_audio chunks
      expect(messages[1].type).toBe('ai_audio');
      expect(messages[2].type).toBe('ai_audio');

      client.close();
    });

    it('persists conversation history in session', async () => {
      const client = await createClient();

      // Create a session
      sendMessage(client, {
        type: 'session_state',
        payload: { slug: 'test-history' },
        timestamp: Date.now(),
      });

      const sessionResponse = await waitForMessage(client);
      const session = sessionResponse.payload as SessionState;

      // Send text input and wait for response
      const messagesPromise = waitForMessages(client, 3);

      sendMessage(client, {
        type: 'text_input',
        payload: { text: 'Test message' },
        timestamp: Date.now(),
      });

      await messagesPromise;

      // Verify conversation was persisted
      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession!.conversationHistory).toHaveLength(2);
      expect(updatedSession!.conversationHistory[0].role).toBe('user');
      expect(updatedSession!.conversationHistory[0].content).toBe('Test message');
      expect(updatedSession!.conversationHistory[1].role).toBe('assistant');

      client.close();
    });
  });

  describe('audio handling', () => {
    it('sends error when no active session for audio', async () => {
      const client = await createClient();
      const messagePromise = waitForMessage(client);

      sendMessage(client, {
        type: 'audio_chunk',
        payload: { chunk: 'base64data', isLast: true },
        timestamp: Date.now(),
      });

      const response = await messagePromise;

      expect(response.type).toBe('error');
      expect((response.payload as { message: string }).message).toBe('No active session. Please start a session first.');

      client.close();
    });

    it('transcribes audio and returns transcript with AI response', async () => {
      const client = await createClient();

      // First create a session
      sendMessage(client, {
        type: 'session_state',
        payload: { slug: 'test-feature' },
        timestamp: Date.now(),
      });

      await waitForMessage(client); // Wait for session_state response

      // Send audio chunk(s) and wait for transcript + AI response + audio chunks
      // Expected: transcript_update + ai_response + 2 ai_audio chunks = 4 messages
      const messagesPromise = waitForMessages(client, 4);

      // Send a final audio chunk
      const audioData = Buffer.from('mock audio data').toString('base64');
      sendMessage(client, {
        type: 'audio_chunk',
        payload: { chunk: audioData, isLast: true },
        timestamp: Date.now(),
      });

      const messages = await messagesPromise;

      // First message should be transcript_update
      expect(messages[0].type).toBe('transcript_update');
      const transcriptPayload = messages[0].payload as { text: string; source: string };
      expect(transcriptPayload.text).toBe('Transcribed text from stream');
      expect(transcriptPayload.source).toBe('voice');

      // Second message should be ai_response
      expect(messages[1].type).toBe('ai_response');

      // Following messages should be ai_audio chunks
      expect(messages[2].type).toBe('ai_audio');
      expect(messages[3].type).toBe('ai_audio');

      client.close();
    });

    it('accumulates multiple audio chunks before transcription', async () => {
      const client = await createClient();

      // First create a session
      sendMessage(client, {
        type: 'session_state',
        payload: { slug: 'test-feature' },
        timestamp: Date.now(),
      });

      await waitForMessage(client); // Wait for session_state response

      // Send multiple audio chunks with isLast=false, then one with isLast=true
      const chunk1 = Buffer.from('chunk 1').toString('base64');
      const chunk2 = Buffer.from('chunk 2').toString('base64');
      const chunk3 = Buffer.from('chunk 3').toString('base64');

      sendMessage(client, {
        type: 'audio_chunk',
        payload: { chunk: chunk1, isLast: false },
        timestamp: Date.now(),
      });

      sendMessage(client, {
        type: 'audio_chunk',
        payload: { chunk: chunk2, isLast: false },
        timestamp: Date.now(),
      });

      // Now send final chunk - this should trigger transcription
      const messagesPromise = waitForMessages(client, 4);

      sendMessage(client, {
        type: 'audio_chunk',
        payload: { chunk: chunk3, isLast: true },
        timestamp: Date.now(),
      });

      const messages = await messagesPromise;

      // First message should be transcript_update
      expect(messages[0].type).toBe('transcript_update');

      client.close();
    });
  });

  describe('stop speaking', () => {
    it('handles stop_speaking message without error', async () => {
      const client = await createClient();

      // First create a session
      sendMessage(client, {
        type: 'session_state',
        payload: { slug: 'test-feature' },
        timestamp: Date.now(),
      });

      await waitForMessage(client);

      // Send stop_speaking - should not error even without active TTS
      sendMessage(client, {
        type: 'stop_speaking',
        payload: {},
        timestamp: Date.now(),
      });

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // No error means success
      client.close();
    });
  });

  describe('invalid messages', () => {
    it('sends error for invalid JSON', async () => {
      const client = await createClient();
      const messagePromise = waitForMessage(client);

      // Send invalid JSON
      client.send('not valid json');

      const response = await messagePromise;

      expect(response.type).toBe('error');
      expect((response.payload as { message: string }).message).toBe('Invalid message format.');

      client.close();
    });
  });
});
