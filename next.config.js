/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
  },
  webpack: (config) => {
    // Optional peer deps of @reown/appkit's wagmi connectors that we don't
    // ship (Porto wallet, pino transports). Stub them so webpack can resolve.
    config.resolve.alias = {
      ...config.resolve.alias,
      porto: false,
      'porto/internal': false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
