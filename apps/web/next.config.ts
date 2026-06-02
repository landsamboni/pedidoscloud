import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  // allowedDevOrigins only needed in local dev; remove the IP if it changes.
  allowedDevOrigins: process.env.NODE_ENV === "development" ? ["192.168.0.172"] : [],
  // Keep Prisma external so Next.js doesn't try to webpack-bundle the binary.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // HTTP security headers — defense in depth alongside Cloudflare.
  // Note: HSTS is already set by Cloudflare. CSP is intentionally omitted
  // until a proper policy is audited to avoid breaking the app.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent the app from being embedded in iframes (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers guessing content types (MIME sniffing attacks)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limit referrer info sent to third-party sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features the app doesn't use
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        // Customer-facing order pages should not be indexed by search engines
        // (they contain personal order data with public tokens).
        source: "/r/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
