import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  images: { unoptimized: true },

  // Set the correct root directory for Turbopack
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Dev proxy for API calls and WebSocket (only works in `npm run dev`, not static export)
  async rewrites() {
    const agentLoopPort = process.env.AGENT_LOOP_PORT || '8001';

    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/ws',
        destination: `http://localhost:${agentLoopPort}/ws`,
      },
    ];
  },
};

export default nextConfig;
