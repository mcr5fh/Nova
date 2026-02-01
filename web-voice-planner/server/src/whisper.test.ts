import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhisperClient } from './whisper';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      audio = {
        transcriptions: {
          create: vi.fn().mockResolvedValue({ text: 'Hello world' }),
        },
      };
    },
    toFile: vi.fn().mockImplementation(async (buffer: Buffer, filename: string) => {
      return { name: filename, data: buffer };
    }),
  };
});

describe('WhisperClient', () => {
  let client: WhisperClient;

  beforeEach(() => {
    client = new WhisperClient();
    vi.clearAllMocks();
  });

  it('transcribes audio buffer', async () => {
    const mockAudio = Buffer.from('mock audio data');

    const result = await client.transcribe(mockAudio);

    expect(result).toBe('Hello world');
  });

  it('combines chunks for stream transcription', async () => {
    const chunks = [
      Buffer.from('chunk1'),
      Buffer.from('chunk2'),
    ];

    const result = await client.transcribeStream(chunks);

    expect(result).toBe('Hello world');
  });

  it('handles empty audio buffer', async () => {
    const mockAudio = Buffer.from('');

    const result = await client.transcribe(mockAudio);

    expect(result).toBe('Hello world');
  });

  it('handles single chunk stream', async () => {
    const chunks = [Buffer.from('single chunk')];

    const result = await client.transcribeStream(chunks);

    expect(result).toBe('Hello world');
  });
});
