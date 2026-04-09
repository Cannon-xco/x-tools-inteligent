import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // We no longer need better-sqlite3
  serverExternalPackages: ['playwright', 'playwright-core', 'pg'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
