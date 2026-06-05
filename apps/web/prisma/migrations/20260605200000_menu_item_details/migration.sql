-- Optional description and photo for catalog menu items.
ALTER TABLE "MenuItem" ADD COLUMN "description" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "imagePath"   TEXT;
