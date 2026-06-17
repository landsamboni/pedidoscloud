-- Additional operator accounts per restaurant (admin-managed only).
CREATE TABLE "RestaurantUser" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantUser_username_key" ON "RestaurantUser"("username");
CREATE INDEX "RestaurantUser_restaurantId_idx" ON "RestaurantUser"("restaurantId");

ALTER TABLE "RestaurantUser" ADD CONSTRAINT "RestaurantUser_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
