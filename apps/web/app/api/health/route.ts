import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Lightweight liveness + DB-readiness probe for uptime monitors and the load
// balancer. Public by design (middleware does not match /api), returns no
// sensitive data, and runs a trivial `SELECT 1` so it never adds real load.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", db: "up", latencyMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.error("health_check_db_down", { err });
    return Response.json(
      { status: "error", db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
