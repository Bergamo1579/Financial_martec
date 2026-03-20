import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: 'next-build-artifacts',
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
