import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  transpilePackages: ['@franchir/synthesis-contract'],
  // dwv (DICOM viewer) charge ses codec web workers depuis `./assets/workers/`.
  // Fichiers vendored dans `public/dwv-workers/` (JPEG-LS, J2K, etc.).
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/:prefix*/assets/workers/:file',
          destination: '/dwv-workers/:file',
        },
        {
          source: '/assets/workers/:file',
          destination: '/dwv-workers/:file',
        },
      ],
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
