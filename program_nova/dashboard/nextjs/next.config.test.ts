import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface Rewrite {
  source: string;
  destination: string;
}

describe('Next.js Configuration - WebSocket Proxy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to ensure fresh config load
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should configure WebSocket proxy with default port', async () => {
    const nextConfig = await import('./next.config');
    const config = nextConfig.default;

    expect(config.rewrites).toBeDefined();
    const rewrites = await config.rewrites!() as Rewrite[];

    const wsRewrite = rewrites.find((r) => r.source === '/ws');
    expect(wsRewrite).toBeDefined();
    expect(wsRewrite?.destination).toBe('http://localhost:8001/ws');
  });

  it('should configure WebSocket proxy with custom AGENT_LOOP_PORT', async () => {
    vi.resetModules();
    process.env.AGENT_LOOP_PORT = '9001';

    const nextConfig = await import('./next.config');
    const config = nextConfig.default;

    const rewrites = await config.rewrites!() as Rewrite[];
    const wsRewrite = rewrites.find((r) => r.source === '/ws');

    expect(wsRewrite?.destination).toBe('http://localhost:9001/ws');
  });

  it('should configure API proxy alongside WebSocket proxy', async () => {
    const nextConfig = await import('./next.config');
    const config = nextConfig.default;

    const rewrites = await config.rewrites!() as Rewrite[];

    const apiRewrite = rewrites.find((r) => r.source === '/api/:path*');
    const wsRewrite = rewrites.find((r) => r.source === '/ws');

    expect(apiRewrite).toBeDefined();
    expect(wsRewrite).toBeDefined();
    expect(rewrites.length).toBeGreaterThanOrEqual(2);
  });
});
