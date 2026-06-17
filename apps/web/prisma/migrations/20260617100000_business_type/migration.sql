-- Add businessType to Restaurant. Existing records default to "restaurant".
ALTER TABLE "Restaurant" ADD COLUMN "businessType" TEXT NOT NULL DEFAULT 'restaurant';
