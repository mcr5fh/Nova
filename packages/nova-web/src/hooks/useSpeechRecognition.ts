import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SpeechRecognitionResult,
  WebSpeechRecognition,
  WebSpeechRecognitionEvent,
  WebSpeechRecognitionErrorEvent,
} from '../types';

export interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  onResult?: (result: SpeechRecognitionResult) => void;
  onSpeechEnd?: (finalTranscript: string) => void;
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
  error: string | null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    continuous = true,
    interimResults = true,
    lang = 'en-US',
    onResult,
    onSpeechEnd,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  // Use refs for callbacks to avoid recreating recognition on every render
  const onResultRef = useRef(onResult);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onErrorRef = useRef(onError);

  // Keep refs in sync with latest callbacks
  onResultRef.current = onResult;
  onSpeechEndRef.current = onSpeechEnd;
  onErrorRef.current = onError;

  const isSupported = typeof window !== 'undefined' && 
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      finalTranscriptRef.current = '';
    };

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
        finalTranscriptRef.current += final;
        setTranscript(finalTranscriptRef.current);

        onResultRef.current?.({
          transcript: final,
          isFinal: true,
          confidence: event.results[event.resultIndex][0].confidence,
        });
      }

      setInterimTranscript(interim);

      if (interim) {
        onResultRef.current?.({
          transcript: interim,
          isFinal: false,
          confidence: 0,
        });
      }
    };

    recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      setError(errorMessage);
      setIsListening(false);
      onErrorRef.current?.(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);

      // Call onSpeechEnd with final transcript
      if (finalTranscriptRef.current.trim()) {
        onSpeechEndRef.current?.(finalTranscriptRef.current.trim());
      }
    };

    recognition.onspeechend = () => {
      // Speech has ended, but recognition may still be processing
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported, continuous, interimResults, lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      // Recognition might already be started
      console.error('Failed to start recognition:', err);
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    recognitionRef.current.stop();
  }, [isListening]);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    start,
    stop,
    error,
  };
}
