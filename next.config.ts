import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // We no longer need better-sqlite3
  serverExternalPackages: ['playwright', 'playwright-core', 'pg'],
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  async rewrites() {
    // If BACKEND_URL is set (e.g. on Vercel), proxy API calls to Railway
    if (process.env.BACKEND_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.BACKEND_URL}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
