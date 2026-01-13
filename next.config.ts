import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'franchir.eu',
        pathname: '/wp-content/uploads/**',
      },
    ],
  },
};

export default nextConfig;
