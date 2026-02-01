import type { TTSService } from '../../types';
import { OpenAITTSService } from './openai';
import { WebSpeechTTSService } from './web-speech';

export type { TTSService };

export type TTSProvider = 'openai' | 'web-speech';

export function createTTSService(provider: TTSProvider = 'openai'): TTSService {
  if (provider === 'openai') {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (apiKey) {
      return new OpenAITTSService(apiKey);
    }
    console.warn('OpenAI API key not found, falling back to Web Speech API');
  }
  return new WebSpeechTTSService();
}

/**
 * Sentence-based streaming TTS for conversational voice.
 * Buffers incoming chunks and speaks complete sentences.
 */
export class StreamingTTS {
  private buffer = '';
  private speaking = false;
  private queue: string[] = [];
  private ttsService: TTSService;
  private onSpeakingChange?: (speaking: boolean) => void;

  constructor(ttsService: TTSService, onSpeakingChange?: (speaking: boolean) => void) {
    this.ttsService = ttsService;
    this.onSpeakingChange = onSpeakingChange;
  }

  addChunk(text: string): void {
    this.buffer += text;

    // Split on sentence boundaries (. ! ?)
    const sentences = this.buffer.split(/(?<=[.!?])\s+/);

    if (sentences.length > 1) {
      // Queue complete sentences for speech
      this.queue.push(...sentences.slice(0, -1));
      this.buffer = sentences[sentences.length - 1];
      this.processQueue();
    }
  }

  flush(): void {
    // Speak any remaining buffer content
    if (this.buffer.trim()) {
      this.queue.push(this.buffer.trim());
      this.buffer = '';
      this.processQueue();
    }
  }

  stop(): void {
    this.queue = [];
    this.buffer = '';
    this.ttsService.stop();
    this.speaking = false;
    this.onSpeakingChange?.(false);
  }

  private async processQueue(): Promise<void> {
    if (this.speaking || this.queue.length === 0) return;

    this.speaking = true;
    this.onSpeakingChange?.(true);

    while (this.queue.length > 0) {
      const sentence = this.queue.shift()!;
      try {
        await this.ttsService.speak(sentence);
      } catch (error) {
        console.error('TTS error:', error);
      }
    }

    this.speaking = false;
    this.onSpeakingChange?.(false);
  }

  isSpeaking(): boolean {
    return this.speaking || this.queue.length > 0;
  }
}
