/**
 * WebSocket configuration for agent chat
 *
 * Environment variables:
 * - NEXT_PUBLIC_WS_URL: Base WebSocket URL (e.g., "ws://localhost:8001" or "wss://example.com")
 *   Defaults to "ws://localhost:8001" if not set
 */

export const getWebSocketUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001';
  return `${baseUrl}/ws`;
};

export const WS_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001',
  endpoint: '/ws',
  get fullUrl() {
    return `${this.baseUrl}${this.endpoint}`;
  },
} as const;
