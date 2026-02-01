import { useState, useRef, useCallback } from 'react';

export interface UseWhisperTranscriptionOptions {
  serverUrl?: string;
  language?: string;
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

export interface UseWhisperTranscriptionReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  error: string | null;
}

/**
 * Hook for recording audio and transcribing via OpenAI Whisper API
 * (proxied through nova-server)
 */
export function useWhisperTranscription(
  options: UseWhisperTranscriptionOptions = {}
): UseWhisperTranscriptionReturn {
  const {
    serverUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
    language = 'en',
    onTranscript,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Use refs for callbacks to avoid recreating on every render
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  const isSupported =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!window.MediaRecorder;

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsTranscribing(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', language);

        const response = await fetch(`${serverUrl}/api/transcribe`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const result = await response.json();
        const text = result.text?.trim();

        if (text) {
          onTranscriptRef.current?.(text);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Transcription failed';
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
      } finally {
        setIsTranscribing(false);
      }
    },
    [serverUrl, language]
  );

  const start = useCallback(async () => {
    if (isRecording || !isSupported) return;

    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm with opus codec, fallback to what's available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());

        // Combine chunks and transcribe
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          transcribeAudio(audioBlob);
        }
      };

      mediaRecorder.onerror = () => {
        const errorMessage = 'MediaRecorder error';
        setError(errorMessage);
        setIsRecording(false);
        onErrorRef.current?.(errorMessage);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
    }
  }, [isRecording, isSupported, transcribeAudio]);

  const stop = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, [isRecording]);

  return {
    isRecording,
    isTranscribing,
    isSupported,
    start,
    stop,
    error,
  };
}
