import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  allowedDevOrigins: ["192.168.0.172"],
  // Keep Prisma external so Next.js doesn't try to webpack-bundle the binary.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
