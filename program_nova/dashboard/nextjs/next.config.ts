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

  // Dev proxy for API calls (only works in `npm run dev`, not static export)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
