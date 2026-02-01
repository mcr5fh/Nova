import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  WebSpeechRecognition,
  WebSpeechRecognitionEvent,
  WebSpeechRecognitionErrorEvent,
} from '../types';

/**
 * Hybrid Speech Recognition Hook
 *
 * Combines the best of both worlds:
 * - Web Speech API for real-time interim transcripts (user feedback)
 * - Whisper (via server) for accurate final transcription
 *
 * When the user speaks:
 * 1. Web Speech API shows what they're saying in real-time
 * 2. MediaRecorder simultaneously captures the audio
 * 3. When speech ends, Whisper provides the accurate final transcript
 */

export interface UseHybridSpeechRecognitionOptions {
  /** Server URL for Whisper transcription (default: from env or localhost:3001) */
  serverUrl?: string;
  /** Language for Whisper transcription (default: 'en') */
  language?: string;
  /** Called when final transcript is ready from Whisper */
  onFinalTranscript?: (text: string) => void;
  /** Called on any error */
  onError?: (error: string) => void;
  /** Whether to enable Web Speech API for interim results (default: true) */
  enableInterimTranscripts?: boolean;
}

export interface UseHybridSpeechRecognitionReturn {
  /** Whether currently recording/listening */
  isListening: boolean;
  /** Whether Whisper is currently transcribing */
  isTranscribing: boolean;
  /** Whether the browser supports both APIs */
  isSupported: boolean;
  /** Current interim transcript from Web Speech API */
  interimTranscript: string;
  /** Final transcript from Web Speech API (may differ from Whisper result) */
  webSpeechTranscript: string;
  /** Start listening */
  start: () => void;
  /** Stop listening and trigger transcription */
  stop: () => void;
  /** Current error if any */
  error: string | null;
}

export function useHybridSpeechRecognition(
  options: UseHybridSpeechRecognitionOptions = {}
): UseHybridSpeechRecognitionReturn {
  const {
    serverUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
    language = 'en',
    onFinalTranscript,
    onError,
    enableInterimTranscripts = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [webSpeechTranscript, setWebSpeechTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs for recognition and recording
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const webSpeechTranscriptRef = useRef('');

  // Callback refs to avoid stale closures
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  onFinalTranscriptRef.current = onFinalTranscript;
  onErrorRef.current = onError;

  // Check browser support
  const webSpeechSupported =
    typeof window !== 'undefined' &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const mediaRecorderSupported =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!window.MediaRecorder;

  // Both APIs are required for hybrid mode
  const isSupported = mediaRecorderSupported; // Web Speech is optional for interim

  // Initialize Web Speech API recognition
  useEffect(() => {
    if (!webSpeechSupported || !enableInterimTranscripts) return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'en' ? 'en-US' : language;

    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        webSpeechTranscriptRef.current += final;
        setWebSpeechTranscript(webSpeechTranscriptRef.current);
      }

      setInterimTranscript(interim);
    };

    recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      // Don't treat "aborted" as a real error - it happens on manual stop
      if (event.error !== 'aborted') {
        console.warn('Web Speech API error:', event.error);
        // Don't set error state - we still have Whisper as backup
      }
    };

    recognition.onend = () => {
      // Web Speech ended, but we don't care - Whisper handles final transcript
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [webSpeechSupported, enableInterimTranscripts, language]);

  // Transcribe audio using Whisper
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
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Transcription failed: ${response.status}`
          );
        }

        const result = await response.json();
        const text = result.text?.trim();

        if (text) {
          onFinalTranscriptRef.current?.(text);
        } else {
          // No text detected - still call with empty to signal completion
          onFinalTranscriptRef.current?.('');
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

  // Start both Web Speech API and MediaRecorder
  const start = useCallback(async () => {
    if (isListening || !isSupported) return;

    setError(null);
    setInterimTranscript('');
    setWebSpeechTranscript('');
    webSpeechTranscriptRef.current = '';
    audioChunksRef.current = [];

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up MediaRecorder for Whisper
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
        // Combine chunks and transcribe with Whisper
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          transcribeAudio(audioBlob);
        } else {
          // No audio captured
          onFinalTranscriptRef.current?.('');
        }
      };

      mediaRecorder.onerror = () => {
        const errorMessage = 'MediaRecorder error';
        setError(errorMessage);
        setIsListening(false);
        onErrorRef.current?.(errorMessage);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // Start Web Speech API for interim transcripts (if available)
      if (recognitionRef.current && enableInterimTranscripts) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          // Web Speech API might fail, but we still have Whisper
          console.warn('Web Speech API failed to start:', err);
        }
      }

      setIsListening(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
    }
  }, [isListening, isSupported, enableInterimTranscripts, transcribeAudio]);

  // Stop both Web Speech API and MediaRecorder
  const stop = useCallback(() => {
    if (!isListening) return;

    // Stop Web Speech API
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore errors on stop
      }
    }

    // Stop MediaRecorder (this triggers onstop which calls transcribeAudio)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsListening(false);
    setInterimTranscript('');
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isListening,
    isTranscribing,
    isSupported,
    interimTranscript,
    webSpeechTranscript,
    start,
    stop,
    error,
  };
}
