-- Performance indexes for multi-tenant scale (20-50+ restaurants).
-- All are additive (CREATE INDEX only) and safe to apply to a live database;
-- the affected tables are small at current volume so the brief lock is negligible.

-- OrderItem.orderId: every order listing joins items on orderId, and cascade
-- deletes scan by it. Postgres does not auto-create FK indexes.
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- Order.customerId: customer stats and customer deletion query orders by customer.
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- Order(restaurantId, status): analytics group/filter confirmed orders per tenant.
CREATE INDEX "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");
