export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence';
}

export interface LLMStreamChunk {
  type: 'text' | 'done';
  text?: string;
}

export interface LLMAdapter {
  chat(messages: LLMMessage[], systemPrompt: string): Promise<LLMResponse>;
  chatStream(
    messages: LLMMessage[],
    systemPrompt: string
  ): AsyncIterable<LLMStreamChunk>;
}
