-- Add per-restaurant background template for the shareable menu image (1080x1350).
ALTER TABLE "Restaurant" ADD COLUMN "menuTemplatePath" TEXT;
