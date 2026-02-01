import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketService, type ConnectionState } from '../services/websocket';
import type { 
  SessionMode, 
  Message, 
  DimensionState, 
  ServerMessage,
  ClientMessage 
} from '../types';

export interface UseNovaSessionOptions {
  wsUrl?: string;
  onChunk?: (text: string) => void;
  onResponseComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

export interface UseNovaSessionReturn {
  // Connection
  connect: () => void;
  disconnect: () => void;
  connectionState: ConnectionState;
  isConnected: boolean;

  // Session
  startSession: (mode: SessionMode, model?: string) => void;
  resumeSession: (sessionId: string) => void;
  sessionId: string | null;
  mode: SessionMode | null;

  // Messages
  sendMessage: (text: string) => void;
  messages: Message[];
  currentResponse: string;
  isProcessing: boolean;

  // Progress
  progress: DimensionState[];

  // Commands
  sendCommand: (cmd: '/progress' | '/export' | '/save', args?: string) => void;
}

export function useNovaSession(
  options: UseNovaSessionOptions = {}
): UseNovaSessionReturn {
  const { wsUrl, onChunk, onResponseComplete, onError } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<SessionMode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<DimensionState[]>([]);

  const wsRef = useRef<WebSocketService | null>(null);
  const responseBufferRef = useRef('');

  useEffect(() => {
    const ws = new WebSocketService({ url: wsUrl });
    wsRef.current = ws;

    ws.setCallbacks({
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onMessage: (message: ServerMessage) => {
        handleServerMessage(message);
      },
      onError: (error) => {
        onError?.(error.message);
      },
    });

    return () => {
      ws.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'session_started':
        setSessionId(message.sessionId);
        break;

      case 'assistant_chunk':
        responseBufferRef.current += message.text;
        setCurrentResponse(responseBufferRef.current);
        onChunk?.(message.text);
        break;

      case 'assistant_done':
        const fullResponse = responseBufferRef.current;
        if (fullResponse) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          onResponseComplete?.(fullResponse);
        }
        responseBufferRef.current = '';
        setCurrentResponse('');
        setIsProcessing(false);
        break;

      case 'progress_update':
        setProgress(message.dimensions);
        break;

      case 'error':
        onError?.(message.message);
        setIsProcessing(false);
        break;

      case 'export_ready':
        // Could emit an event or callback here
        console.log('Export ready:', message.format);
        break;
    }
  }, [onChunk, onResponseComplete, onError]);

  const connect = useCallback(() => {
    wsRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    setSessionId(null);
    setMode(null);
    setMessages([]);
    setProgress([]);
  }, []);

  const startSession = useCallback((sessionMode: SessionMode, model?: string) => {
    const message: ClientMessage = {
      type: 'start_session',
      mode: sessionMode,
      model,
    };
    if (wsRef.current?.send(message)) {
      setMode(sessionMode);
      setMessages([]);
      setProgress([]);
    }
  }, []);

  const resumeSession = useCallback((id: string) => {
    const message: ClientMessage = {
      type: 'resume_session',
      sessionId: id,
    };
    wsRef.current?.send(message);
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const message: ClientMessage = {
      type: 'user_message',
      text,
    };
    
    if (wsRef.current?.send(message)) {
      setIsProcessing(true);
      responseBufferRef.current = '';
      setCurrentResponse('');
    }
  }, [isProcessing]);

  const sendCommand = useCallback((cmd: '/progress' | '/export' | '/save', args?: string) => {
    const message: ClientMessage = {
      type: 'command',
      cmd,
      args,
    };
    wsRef.current?.send(message);
  }, []);

  return {
    connect,
    disconnect,
    connectionState,
    isConnected: connectionState === 'connected',

    startSession,
    resumeSession,
    sessionId,
    mode,

    sendMessage,
    messages,
    currentResponse,
    isProcessing,

    progress,

    sendCommand,
  };
}
