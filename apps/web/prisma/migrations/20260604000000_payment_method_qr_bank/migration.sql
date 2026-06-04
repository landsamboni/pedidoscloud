-- QR + bank fields for payment methods.
ALTER TABLE "PaymentMethod" ADD COLUMN "qrPath" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN "accountType" TEXT;
ALTER TABLE "PaymentMethod" ADD COLUMN "idNumber" TEXT;
