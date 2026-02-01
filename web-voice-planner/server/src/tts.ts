import OpenAI from 'openai';

export class TTSClient {
  private client: OpenAI;
  private currentRequest: AbortController | null = null;

  constructor() {
    this.client = new OpenAI();
  }

  async synthesize(text: string): Promise<Buffer> {
    this.currentRequest = new AbortController();

    const response = await this.client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    this.currentRequest = null;
    return Buffer.from(arrayBuffer);
  }

  async synthesizeStreaming(
    text: string,
    onChunk: (chunk: Buffer) => void
  ): Promise<void> {
    this.currentRequest = new AbortController();

    // Split text into sentences for chunked TTS
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (const sentence of sentences) {
      if (this.currentRequest?.signal.aborted) {
        break;
      }

      const trimmed = sentence.trim();
      if (!trimmed) continue;

      try {
        const response = await this.client.audio.speech.create({
          model: 'tts-1',
          voice: 'nova',
          input: trimmed,
          response_format: 'mp3',
        });

        const arrayBuffer = await response.arrayBuffer();
        onChunk(Buffer.from(arrayBuffer));
      } catch (error) {
        // If aborted, don't throw
        if (this.currentRequest?.signal.aborted) {
          break;
        }
        throw error;
      }
    }

    this.currentRequest = null;
  }

  stop(): void {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }
  }

  isActive(): boolean {
    return this.currentRequest !== null;
  }
}
