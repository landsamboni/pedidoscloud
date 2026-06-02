-- Add subscription tracking fields to Restaurant.
-- subscriptionEndsAt drives all status calculations; no status enum needed.
ALTER TABLE "Restaurant" ADD COLUMN "subscriptionStartedAt" TIMESTAMP(3);
ALTER TABLE "Restaurant" ADD COLUMN "subscriptionEndsAt"    TIMESTAMP(3);
