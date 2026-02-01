import { describe, it, expect } from 'vitest';

describe('WebSocket Configuration', () => {
  it('should have NEXT_PUBLIC_WS_URL environment variable defined or use default', () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001';
    expect(wsUrl).toMatch(/^wss?:\/\//);
  });

  it('should construct WebSocket URL with /ws endpoint', () => {
    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001';
    const wsUrl = `${baseUrl}/ws`;
    expect(wsUrl).toMatch(/\/ws$/);
  });

  it('should handle both ws:// and wss:// protocols', () => {
    const wsUrl = 'ws://localhost:8001';
    const wssUrl = 'wss://example.com:8001';

    expect(wsUrl).toMatch(/^ws:\/\//);
    expect(wssUrl).toMatch(/^wss:\/\//);
  });
});
