import type { TTSService } from '../../types';

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type OpenAIModel = 'tts-1' | 'tts-1-hd';

interface OpenAITTSOptions {
  voice?: OpenAIVoice;
  model?: OpenAIModel;
  speed?: number;
  /** Server proxy URL for TTS requests (recommended for security) */
  proxyUrl?: string;
}

/**
 * OpenAI TTS implementation (primary service)
 *
 * Supports two modes:
 * 1. Direct API calls (requires API key in browser - not recommended for production)
 * 2. Server proxy (recommended - keeps API key secure on server)
 */
export class OpenAITTSService implements TTSService {
  private apiKey: string | null;
  private proxyUrl: string | null;
  private voice: OpenAIVoice;
  private model: OpenAIModel;
  private speed: number;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private speaking = false;

  /**
   * Create an OpenAI TTS service
   * @param apiKeyOrProxyUrl - Either an OpenAI API key for direct calls, or a proxy URL
   * @param options - TTS options including voice, model, speed, and optional proxyUrl
   */
  constructor(apiKeyOrProxyUrl: string, options: OpenAITTSOptions = {}) {
    // Determine if this is an API key or proxy URL
    if (options.proxyUrl) {
      this.proxyUrl = options.proxyUrl;
      this.apiKey = apiKeyOrProxyUrl;
    } else if (apiKeyOrProxyUrl.startsWith('http://') || apiKeyOrProxyUrl.startsWith('https://')) {
      // URL provided as first argument - use proxy mode without API key
      this.proxyUrl = apiKeyOrProxyUrl;
      this.apiKey = null;
    } else {
      // API key provided - use direct mode
      this.apiKey = apiKeyOrProxyUrl;
      this.proxyUrl = null;
    }

    this.voice = options.voice ?? 'nova';
    this.model = options.model ?? 'tts-1';
    this.speed = options.speed ?? 1.0;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async speak(text: string): Promise<void> {
    if (!text.trim()) return;

    try {
      this.speaking = true;

      let response: Response;

      if (this.proxyUrl) {
        // Use server proxy
        response = await fetch(this.proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice: this.voice,
            model: this.model,
            speed: this.speed,
          }),
        });
      } else if (this.apiKey) {
        // Direct OpenAI API call
        response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            input: text,
            voice: this.voice,
            speed: this.speed,
            response_format: 'mp3',
          }),
        });
      } else {
        throw new Error('OpenAI TTS: No API key or proxy URL configured');
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI TTS error: ${response.status} - ${error}`);
      }

      const audioData = await response.arrayBuffer();
      const audioContext = this.getAudioContext();

      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const audioBuffer = await audioContext.decodeAudioData(audioData);

      return new Promise((resolve) => {
        const source = audioContext.createBufferSource();
        this.currentSource = source;
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        source.onended = () => {
          this.speaking = false;
          this.currentSource = null;
          resolve();
        };

        source.start(0);
      });
    } catch (error) {
      this.speaking = false;
      throw error;
    }
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Source may already be stopped
      }
      this.currentSource = null;
    }
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  setVoice(voice: OpenAIVoice): void {
    this.voice = voice;
  }

  setModel(model: OpenAIModel): void {
    this.model = model;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(4.0, speed));
  }
}
