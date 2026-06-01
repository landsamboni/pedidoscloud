-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_REVIEW';
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_REJECTED';

-- AlterTable
ALTER TABLE "Restaurant"
ADD COLUMN "nequiAccountName" TEXT,
ADD COLUMN "nequiPhone" TEXT,
ADD COLUMN "nequiQrPath" TEXT;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "publicToken" TEXT,
ADD COLUMN "paymentProofPath" TEXT,
ADD COLUMN "paymentSubmittedAt" TIMESTAMP(3);

UPDATE "Order"
SET "publicToken" = gen_random_uuid()::text
WHERE "publicToken" IS NULL;

ALTER TABLE "Order"
ALTER COLUMN "publicToken" SET NOT NULL;

CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
