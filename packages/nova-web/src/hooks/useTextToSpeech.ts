import { useState, useEffect, useCallback, useRef } from 'react';
import { createTTSService, StreamingTTS, type TTSProvider, type TTSService } from '../services/tts';

export interface UseTextToSpeechOptions {
  provider?: TTSProvider;
  autoStart?: boolean;
}

export interface UseTextToSpeechReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  addChunk: (text: string) => void;
  flush: () => void;
  stopStreaming: () => void;
}

export function useTextToSpeech(
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn {
  const { provider = 'openai' } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);

  const ttsServiceRef = useRef<TTSService | null>(null);
  const streamingTTSRef = useRef<StreamingTTS | null>(null);

  useEffect(() => {
    const ttsService = createTTSService(provider);
    ttsServiceRef.current = ttsService;

    streamingTTSRef.current = new StreamingTTS(ttsService, (speaking) => {
      setIsSpeaking(speaking);
    });

    return () => {
      streamingTTSRef.current?.stop();
    };
  }, [provider]);

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!ttsServiceRef.current) return;

    setIsSpeaking(true);
    try {
      await ttsServiceRef.current.speak(text);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    ttsServiceRef.current?.stop();
    streamingTTSRef.current?.stop();
    setIsSpeaking(false);
  }, []);

  const addChunk = useCallback((text: string) => {
    streamingTTSRef.current?.addChunk(text);
  }, []);

  const flush = useCallback(() => {
    streamingTTSRef.current?.flush();
  }, []);

  const stopStreaming = useCallback(() => {
    streamingTTSRef.current?.stop();
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    addChunk,
    flush,
    stopStreaming,
  };
}
