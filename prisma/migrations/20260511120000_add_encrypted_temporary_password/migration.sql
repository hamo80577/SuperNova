ALTER TABLE "User"
ADD COLUMN "temporaryPasswordCiphertext" TEXT,
ADD COLUMN "temporaryPasswordCreatedAt" TIMESTAMP(3);
