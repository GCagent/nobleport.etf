/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Replit deployments - allows all hosts
  images: {
    unoptimized: true,
  },

  // Ensure the app binds to 0.0.0.0 (not localhost)
  // This is critical for Replit deployments
  experimental: {
    // Enable server actions if needed
  },

  // Output standalone build for better deployment compatibility
  output: 'standalone',

  // Environment variables available at build time
  env: {
    NEXT_PUBLIC_APP_NAME: 'NoblePort ETF',
  },
};

module.exports = nextConfig;
