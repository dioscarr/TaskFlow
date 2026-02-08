import type { NextConfig } from "next";

// Bundle analyzer setup
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  output: "standalone",

  // Optimize production builds
  reactStrictMode: true,

  // Enable compression
  compress: true,

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
      allowedOrigins: [
        'localhost:3000',
        'localhost:5000',
        '*.devtunnels.ms',
        'vscode-app.net'
      ],
    },

    // Enable optimizeCss for production builds
    optimizeCss: true,

    // Enable optimized package imports
    optimizePackageImports: ['lucide-react', 'framer-motion', '@uiw/react-codemirror'],
  },

  // Configure headers for caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);


