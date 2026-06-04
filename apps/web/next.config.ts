import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inline AUTH_SECRET at BUILD time so the Edge middleware bundle always has the
  // correct signing secret. On Amplify WEB_COMPUTE, env vars are NOT injected into
  // the runtime (lib/runtime-env.ts works around this for the Node SSR path, but
  // middleware can't use that). Without this, middleware falls back to a different
  // secret on cold Lambdas and JWT verification fails — login appears to "do
  // nothing" and bounces back to /login. AUTH_SECRET is available at build time
  // (see amplify.yml), and is only referenced server-side, so it is not exposed
  // to the client bundle.
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET ?? "",
  },
  experimental: {
    serverActions: {
      // Set above our server-side MAX_UPLOAD_BYTES (12 MB) so Next.js never
      // rejects the request with a 413 before our code runs. Mobile phone
      // photos are routinely 10–20 MB; a 413 from Next.js causes an unhandled
      // client-side crash instead of a friendly "file too large" error.
      bodySizeLimit: "25mb",
    },
  },
  // allowedDevOrigins only needed in local dev; remove the IP if it changes.
  allowedDevOrigins: process.env.NODE_ENV === "development" ? ["192.168.0.172"] : [],
  // Keep Prisma external so Next.js doesn't try to webpack-bundle the binary.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Bundle the preset menu-template images into the SSR function so the menu-image
  // route can read them from disk (Amplify serves /public via CDN only — the files
  // are NOT on the compute filesystem by default).
  outputFileTracingIncludes: {
    "/r/[restaurantSlug]/menu-image": ["./public/menu-templates/**/*", "./public/logo-default.png"],
  },
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
