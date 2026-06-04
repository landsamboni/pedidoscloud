-- Last 4 uploaded menu templates (most recent first).
ALTER TABLE "Restaurant" ADD COLUMN "menuTemplateHistory" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
