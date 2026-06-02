-- Add customerName snapshot to Order.
-- Backfills existing rows from the current Customer.name.
-- Going forward, createOrder stores the name directly so order history
-- is never affected by subsequent customer upserts.

ALTER TABLE "Order" ADD COLUMN "customerName" TEXT;

-- Backfill from the joined Customer table
UPDATE "Order" o
SET "customerName" = c.name
FROM "Customer" c
WHERE o."customerId" = c.id;

-- Fallback for any orphaned rows (shouldn't exist, but be safe)
UPDATE "Order" SET "customerName" = 'Cliente' WHERE "customerName" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "customerName" SET NOT NULL;
