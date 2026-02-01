/**
 * React hook for managing voice chat with WebSocket connection
 *
 * Features:
 * - WebSocket connection to /ws/voice endpoint
 * - Audio recording and streaming to server
 * - Real-time transcript display
 * - Audio playback from server responses
 * - Voice state management (listening, processing, speaking, idle)
 * - Automatic cleanup on unmount
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { VoiceStateEvent, TranscriptEvent, VoiceResponseEvent } from "../types/chat";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

/**
 * Voice pipeline states
 */
export type VoiceState = "disconnected" | "connecting" | "connected" | "listening" | "processing" | "speaking";

/**
 * Options for useVoiceChat hook
 */
export interface UseVoiceChatOptions {
  /**
   * WebSocket URL override (defaults to NEXT_PUBLIC_WS_URL or ws://localhost:8001)
   */
  url?: string;

  /**
   * Callback fired when voice state changes
   */
  onStateChange?: (state: VoiceState) => void;

  /**
   * Callback fired when transcript is received
   */
  onTranscript?: (text: string, isFinal: boolean) => void;

  /**
   * Callback fired when agent response is received
   */
  onResponse?: (text: string) => void;

  /**
   * Callback fired on error
   */
  onError?: (error: Error) => void;
}

/**
 * Return type for useVoiceChat hook
 */
export interface UseVoiceChatReturn {
  /**
   * Current voice pipeline state
   */
  voiceState: VoiceState;

  /**
   * Current transcript text (interim or final)
   */
  transcript: string;

  /**
   * Current agent response text
   */
  agentResponse: string;

  /**
   * Whether currently recording audio
   */
  isRecording: boolean;

  /**
   * Whether currently playing audio
   */
  isPlaying: boolean;

  /**
   * Connect to voice WebSocket endpoint
   */
  connect: () => Promise<void>;

  /**
   * Disconnect from voice WebSocket endpoint
   */
  disconnect: () => void;

  /**
   * Start recording audio from microphone
   */
  startRecording: () => Promise<void>;

  /**
   * Stop recording audio
   */
  stopRecording: () => void;

  /**
   * Last error that occurred (null if no error)
   */
  lastError: Error | null;
}

/**
 * React hook for voice chat functionality
 *
 * @param options - Configuration options
 * @returns Hook state and control functions
 *
 * @example
 * ```tsx
 * const {
 *   voiceState,
 *   transcript,
 *   connect,
 *   disconnect,
 *   startRecording,
 *   stopRecording,
 * } = useVoiceChat({
 *   onTranscript: (text, isFinal) => console.log('Transcript:', text),
 *   onResponse: (text) => console.log('Response:', text),
 * });
 *
 * // Connect and start recording
 * await connect();
 * await startRecording();
 * ```
 */
export function useVoiceChat(options: UseVoiceChatOptions = {}): UseVoiceChatReturn {
  const {
    url = `${WS_URL}/voice`,
    onStateChange,
    onTranscript,
    onResponse,
    onError,
  } = options;

  const [voiceState, setVoiceState] = useState<VoiceState>("disconnected");
  const [transcript, setTranscript] = useState<string>("");
  const [agentResponse, setAgentResponse] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Update voice state with callback
  const updateVoiceState = useCallback(
    (newState: VoiceState) => {
      setVoiceState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  // Handle voice events from server
  const handleVoiceEvent = useCallback(
    (event: VoiceStateEvent | TranscriptEvent | VoiceResponseEvent) => {
      switch (event.type) {
        case "voice_state":
          updateVoiceState(event.state as VoiceState);
          break;
        case "transcript":
          setTranscript(event.text);
          onTranscript?.(event.text, event.is_final);
          break;
        case "voice_response":
          setAgentResponse(event.text);
          onResponse?.(event.text);
          break;
      }
    },
    [updateVoiceState, onTranscript, onResponse]
  );

  // Play audio buffer
  const playNext = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      currentSourceRef.current = null;
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    const arrayBuffer = audioQueueRef.current.shift()!;
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        currentSourceRef.current = null;
        playNext();
      };
      currentSourceRef.current = source;
      source.start();
    } catch (error) {
      console.error("Failed to decode audio:", error);
      playNext(); // Try next chunk
    }
  }, []);

  // Queue and play audio from server
  const playAudio = useCallback(
    async (arrayBuffer: ArrayBuffer) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }

      audioQueueRef.current.push(arrayBuffer);

      if (!isPlayingRef.current) {
        playNext();
      }
    },
    [playNext]
  );

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    updateVoiceState("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        updateVoiceState("connected");
        // Send start message to server
        ws.send(JSON.stringify({ type: "start" }));
      };

      ws.onmessage = async (event) => {
        // Check if data is binary (Blob or has arrayBuffer method)
        if (event.data instanceof Blob || (typeof event.data === "object" && event.data.arrayBuffer)) {
          // Binary audio data - play it
          const arrayBuffer = await event.data.arrayBuffer();
          await playAudio(arrayBuffer);
        } else if (typeof event.data === "string") {
          // JSON event
          try {
            const data = JSON.parse(event.data);
            handleVoiceEvent(data);
          } catch (error) {
            console.error("Failed to parse voice event:", error);
          }
        }
      };

      ws.onerror = (error) => {
        console.error("Voice WebSocket error:", error);
        const err = new Error("WebSocket connection error");
        setLastError(err);
        onError?.(err);
        updateVoiceState("disconnected");
      };

      ws.onclose = () => {
        updateVoiceState("disconnected");
      };
    } catch (error) {
      console.error("Failed to connect:", error);
      const err = error instanceof Error ? error : new Error("Connection failed");
      setLastError(err);
      onError?.(err);
      updateVoiceState("disconnected");
    }
  }, [url, updateVoiceState, handleVoiceEvent, playAudio, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }

    // Stop audio playback
    audioQueueRef.current = [];
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
      currentSourceRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsRecording(false);
    updateVoiceState("disconnected");
  }, [updateVoiceState]);

  // Start recording audio
  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const err = new Error("WebSocket not connected");
      setLastError(err);
      onError?.(err);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine the best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send audio chunk to server
          wsRef.current.send(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Send chunks every 100ms
      setIsRecording(true);
      updateVoiceState("listening");
    } catch (error) {
      console.error("Failed to start recording:", error);
      const err = error instanceof Error ? error : new Error("Failed to start recording");
      setLastError(err);
      onError?.(err);
    }
  }, [updateVoiceState, onError]);

  // Stop recording audio
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [disconnect]);

  return {
    voiceState,
    transcript,
    agentResponse,
    isRecording,
    isPlaying,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    lastError,
  };
}
