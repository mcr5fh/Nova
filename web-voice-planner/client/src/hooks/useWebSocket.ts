import { useState, useEffect, useRef, useCallback } from 'react';
import type { WSMessage, SessionState } from '../../../shared/types';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [session, setSession] = useState<SessionState | null>(null);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10;

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('error');
      return;
    }

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttempts.current = 0;
      // Try to resume session from localStorage
      const savedSessionId = localStorage.getItem('sessionId');
      if (savedSessionId) {
        send({ type: 'session_state', payload: { sessionId: savedSessionId }, timestamp: Date.now() });
      }
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WSMessage;
      setLastMessage(message);

      if (message.type === 'session_state') {
        const sessionData = message.payload as SessionState;
        setSession(sessionData);
        localStorage.setItem('sessionId', sessionData.id);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      reconnectAttempts.current++;
      const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectTimeoutRef.current = window.setTimeout(connect, backoff);
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [url, send]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
  }, []);

  const startSession = useCallback((slug: string) => {
    send({ type: 'session_state', payload: { slug }, timestamp: Date.now() });
  }, [send]);

  const sendText = useCallback((text: string) => {
    send({ type: 'text_input', payload: { text }, timestamp: Date.now() });
  }, [send]);

  const sendAudioChunk = useCallback((chunk: string, isLast: boolean) => {
    send({ type: 'audio_chunk', payload: { chunk, isLast }, timestamp: Date.now() });
  }, [send]);

  const stopSpeaking = useCallback(() => {
    send({ type: 'stop_speaking', payload: {}, timestamp: Date.now() });
  }, [send]);

  const generateSpec = useCallback(() => {
    send({ type: 'generate_spec', payload: {}, timestamp: Date.now() });
  }, [send]);

  const clearSession = useCallback(() => {
    localStorage.removeItem('sessionId');
    setSession(null);
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    status,
    session,
    lastMessage,
    startSession,
    sendText,
    sendAudioChunk,
    stopSpeaking,
    generateSpec,
    clearSession,
  };
}
