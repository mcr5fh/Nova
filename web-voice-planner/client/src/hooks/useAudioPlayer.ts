import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

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
      console.error('Failed to decode audio:', error);
      playNext(); // Try next chunk
    }
  }, []);

  const playChunk = useCallback(async (base64Audio: string) => {
    ensureAudioContext();

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    audioQueueRef.current.push(bytes.buffer);

    if (!isPlayingRef.current) {
      playNext();
    }
  }, [ensureAudioContext, playNext]);

  const stop = useCallback(() => {
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
  }, []);

  return {
    isPlaying,
    playChunk,
    stop,
  };
}
