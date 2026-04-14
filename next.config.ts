import type { NextConfig } from 'next';

// Allowed origins for Server Actions (CSRF protection).
// Add your Railway / custom domain via env var:
//   ALLOWED_ORIGINS=my-app.up.railway.app,www.mysite.com
const extraOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const nextConfig: NextConfig = {
  output: 'standalone',
  // We no longer need better-sqlite3
  serverExternalPackages: ['playwright', 'playwright-core', 'pg'],
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', ...extraOrigins],
    },
  },
};

export default nextConfig;
