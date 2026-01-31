import Anthropic from '@anthropic-ai/sdk';
import { LLMAdapter, LLMMessage, LLMResponse, LLMStreamChunk } from './types';

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private modelId: string;

  constructor(apiKey: string, modelId: string) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  async chat(messages: LLMMessage[], systemPrompt: string): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return {
      content: textBlock?.text ?? '',
      stopReason: response.stop_reason === 'end_turn' ? 'end_turn' : 'max_tokens',
    };
  }

  async *chatStream(
    messages: LLMMessage[],
    systemPrompt: string
  ): AsyncIterable<LLMStreamChunk> {
    const stream = this.client.messages.stream({
      model: this.modelId,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      }
    }
    yield { type: 'done' };
  }
}
