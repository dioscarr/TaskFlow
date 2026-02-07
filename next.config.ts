import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
  },
};

export default nextConfig;
