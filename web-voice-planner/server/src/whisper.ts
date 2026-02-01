import OpenAI, { toFile } from 'openai';

export class WhisperClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI();
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    // Convert buffer to a file-like object using OpenAI's toFile helper
    const file = await toFile(audioBuffer, 'audio.webm', { type: 'audio/webm' });

    const response = await this.client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'en',
    });

    return response.text;
  }

  async transcribeStream(audioChunks: Buffer[]): Promise<string> {
    // Combine chunks into single buffer
    const combined = Buffer.concat(audioChunks);
    return this.transcribe(combined);
  }
}
