import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  allowedDevOrigins: ["192.168.0.172"],
  // Prevent Next.js from bundling Prisma — it needs native binaries at runtime
  // that webpack cannot include. Mark as external so Node.js require() finds
  // the binary from node_modules at runtime (standard fix for serverless SSR).
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
