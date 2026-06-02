import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles the Next.js server + a minimal node_modules
  // (including Prisma's native binary) into .next/standalone. This is
  // required for Amplify WEB_COMPUTE SSR — without it, node_modules are not
  // available at runtime and Prisma fails on dynamic/SSR routes.
  output: "standalone",
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
