-- Delivery config (per restaurant) + pickup option, and per-order fulfillment/fee.
ALTER TABLE "Restaurant" ADD COLUMN "deliveryMode" TEXT NOT NULL DEFAULT 'separate';
ALTER TABLE "Restaurant" ADD COLUMN "deliveryFee" DECIMAL(12,2);
ALTER TABLE "Restaurant" ADD COLUMN "deliveryNote" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "allowPickup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Order" ADD COLUMN "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "fulfillment" TEXT NOT NULL DEFAULT 'delivery';
