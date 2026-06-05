-- flexible-menu feature: dynamic categories, per-item prices, free quantities.
-- Fully backward-compatible: existing combo restaurants keep working unchanged.

-- Restaurant: menu type + order unit label
ALTER TABLE "Restaurant" ADD COLUMN "menuType"       TEXT NOT NULL DEFAULT 'combo';
ALTER TABLE "Restaurant" ADD COLUMN "orderUnitLabel" TEXT NOT NULL DEFAULT 'almuerzo';

-- Dynamic menu categories (catalog mode)
CREATE TABLE "MenuCategory" (
  "id"       TEXT NOT NULL,
  "menuId"   TEXT NOT NULL,
  "name"     TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MenuCategory_menuId_idx" ON "MenuCategory"("menuId");
ALTER TABLE "MenuCategory"
  ADD CONSTRAINT "MenuCategory_menuId_fkey"
  FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dynamic menu items with per-item price (catalog mode)
CREATE TABLE "MenuItem" (
  "id"         TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "price"      DECIMAL(12,2) NOT NULL,
  "position"   INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrderItem: new catalog fields (nullable / defaulted so existing rows are untouched)
ALTER TABLE "OrderItem" ADD COLUMN "catalogCategory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD COLUMN "catalogItem"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD COLUMN "quantity"        INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "OrderItem" ADD COLUMN "unitPrice"       DECIMAL(12,2) NOT NULL DEFAULT 0;
-- Make legacy combo fields nullable-friendly (they keep their values in existing rows)
ALTER TABLE "OrderItem" ALTER COLUMN "soup"    SET DEFAULT '';
ALTER TABLE "OrderItem" ALTER COLUMN "protein" SET DEFAULT '';
ALTER TABLE "OrderItem" ALTER COLUMN "side"    SET DEFAULT '';
ALTER TABLE "OrderItem" ALTER COLUMN "drink"   SET DEFAULT '';
ALTER TABLE "OrderItem" ALTER COLUMN "price"   SET DEFAULT 0;
