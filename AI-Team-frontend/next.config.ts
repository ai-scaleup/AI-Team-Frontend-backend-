import type { NextConfig } from "next";

// next.config.js (or next.config.mjs / next.config.ts)
const nextConfig = {
  images: {
    // EITHER simple domain allow-list:
    // domains: ['www.ai-scaleup.com', 'ai-scaleup.com'],

    // OR (recommended) remotePatterns with protocol + path:
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.ai-scaleup.com',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'ai-scaleup.com',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'image2url.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
