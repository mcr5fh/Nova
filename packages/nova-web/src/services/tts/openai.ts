import type { TTSService } from '../../types';

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type OpenAIModel = 'tts-1' | 'tts-1-hd';

interface OpenAITTSOptions {
  voice?: OpenAIVoice;
  model?: OpenAIModel;
  speed?: number;
}

/**
 * OpenAI TTS implementation (primary service)
 * Uses the /v1/audio/speech endpoint
 */
export class OpenAITTSService implements TTSService {
  private apiKey: string;
  private voice: OpenAIVoice;
  private model: OpenAIModel;
  private speed: number;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private speaking = false;

  constructor(apiKey: string, options: OpenAITTSOptions = {}) {
    this.apiKey = apiKey;
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

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
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
