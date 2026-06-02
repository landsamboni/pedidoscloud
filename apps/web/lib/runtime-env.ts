/**
 * Amplify WEB_COMPUTE injects env vars into CodeBuild (build time) but NOT into
 * the SSR Lambda runtime. As a workaround, amplify.yml writes the env vars to
 * .next/.env.runtime during build (which is deployed with the .next artifact).
 * This module reads that file and sets process.env before Prisma/S3 init.
 *
 * Call loadRuntimeEnv() at the top of lib/prisma.ts and lib/storage.ts
 * (Node.js only — do NOT import this from middleware or client components).
 */
import { readFileSync } from "fs";
import { join } from "path";

let loaded = false;

export function loadRuntimeEnv(): void {
  if (loaded) return;
  loaded = true;

  // Try several candidate paths — the Lambda CWD varies by Amplify version.
  const candidates = [
    join(process.cwd(), ".next", ".env.runtime"),
    join(process.cwd(), ".env.runtime"),
    join(__dirname, ".env.runtime"),       // .next/server/chunks/ → one up?
    join(__dirname, "..", ".env.runtime"),
    join(__dirname, "..", "..", ".env.runtime"),
    join(__dirname, "..", "..", "..", ".env.runtime"),
  ];

  for (const p of candidates) {
    try {
      const lines = readFileSync(p, "utf8").split("\n");
      for (const line of lines) {
        const eq = line.indexOf("=");
        if (eq > 0) {
          const key = line.slice(0, eq).trim();
          const val = line.slice(eq + 1); // preserve everything after first =
          if (key && !process.env[key]) process.env[key] = val;
        }
      }
      return; // loaded successfully
    } catch {
      continue;
    }
  }
}
