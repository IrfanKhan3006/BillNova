import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared hosting (Hostinger) kills parallel build workers; build with one
  // worker there. Vercel has no such limit.
  experimental: process.env.VERCEL ? {} : { cpus: 1, workerThreads: false },
};

export default nextConfig;
