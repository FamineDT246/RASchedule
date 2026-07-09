import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No output: "standalone" — Vercel handles deployment automatically
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
