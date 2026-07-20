import type { NextConfig } from "next";
import { DWV_NEXT_CONFIG_REWRITES } from '@franchir/imaging-viewer/worker-rewrite';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  transpilePackages: ['@franchir/synthesis-contract', '@franchir/imaging-viewer'],
  // dwv workers : rewrites SoT `@franchir/imaging-viewer/worker-rewrite`.
  // Les chemins sous `/_next/*` restent au middleware (`proxy.ts`).
  async rewrites() {
    return {
      afterFiles: [...DWV_NEXT_CONFIG_REWRITES],
      beforeFiles: [],
      fallback: [],
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'franchir.eu',
        pathname: '/wp-content/uploads/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

export default nextConfig;
