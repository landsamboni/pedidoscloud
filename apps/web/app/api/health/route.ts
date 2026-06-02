import { NextResponse } from "next/server";
import { loadRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

// Diagnostic endpoint — shows runtime environment and DB connectivity.
// Remove or gate behind auth before going to prod.
export async function GET() {
  loadRuntimeEnv();

  const info: Record<string, unknown> = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    dirname: __dirname,
    DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
    STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "not set",
    S3_BUCKET: process.env.S3_BUCKET ?? "not set",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? "set" : "not set",
  };

  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.restaurant.count();
    info.db = "connected";
    info.restaurantCount = count;
  } catch (err) {
    info.db = "ERROR";
    info.dbError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(info);
}
