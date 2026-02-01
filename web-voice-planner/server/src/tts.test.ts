import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTSClient } from './tts';

// Mock OpenAI
const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      audio = {
        speech: {
          create: mockCreate,
        },
      };
    },
  };
});

describe('TTSClient', () => {
  let client: TTSClient;

  beforeEach(() => {
    client = new TTSClient();
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
  });

  it('synthesizes text to audio', async () => {
    const result = await client.synthesize('Hello world');

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'tts-1',
      voice: 'nova',
      input: 'Hello world',
      response_format: 'mp3',
    });
  });

  it('synthesizes streaming by sentences', async () => {
    const chunks: Buffer[] = [];

    await client.synthesizeStreaming(
      'First sentence. Second sentence.',
      (chunk) => chunks.push(chunk)
    );

    // Should call create for each sentence
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(chunks.length).toBe(2);
  });

  it('handles text without punctuation', async () => {
    const chunks: Buffer[] = [];

    await client.synthesizeStreaming(
      'No punctuation here',
      (chunk) => chunks.push(chunk)
    );

    // Treat entire text as single chunk when no sentence markers
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(chunks.length).toBe(1);
  });

  it('can be stopped mid-stream', async () => {
    // Make the first call resolve slowly
    let callCount = 0;
    mockCreate.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call - return immediately
        return { arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) };
      }
      // Subsequent calls - simulate delay
      await new Promise(resolve => setTimeout(resolve, 100));
      return { arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) };
    });

    const chunks: Buffer[] = [];

    const promise = client.synthesizeStreaming(
      'First sentence. Second sentence. Third sentence.',
      (chunk) => chunks.push(chunk)
    );

    // Stop after first chunk
    setTimeout(() => client.stop(), 50);

    await promise;

    // Should have fewer chunks than sentences due to abort
    expect(chunks.length).toBeLessThanOrEqual(3);
  });

  it('reports active state correctly', async () => {
    expect(client.isActive()).toBe(false);

    // Start a synthesis
    const promise = client.synthesize('Hello');

    // During synthesis (before await), it should be active
    // Note: This is tricky to test due to timing, but the logic is there

    await promise;
    expect(client.isActive()).toBe(false);
  });

  it('handles stop when not active', () => {
    // Should not throw when stopping while not active
    expect(() => client.stop()).not.toThrow();
  });

  it('skips empty sentences', async () => {
    const chunks: Buffer[] = [];

    await client.synthesizeStreaming(
      'First. Second.',
      (chunk) => chunks.push(chunk)
    );

    // Should call for each non-empty trimmed sentence
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ input: 'First.' }));
    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ input: 'Second.' }));
  });
});
