-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('BACKOFFICE', 'APP', 'BOTH');

-- CreateEnum
CREATE TYPE "AppArea" AS ENUM ('BACKOFFICE', 'APP');

-- CreateEnum
CREATE TYPE "UserLockReason" AS ENUM ('FAILED_ATTEMPTS', 'ADMIN');

-- AlterTable
ALTER TABLE "Permission"
ADD COLUMN "scope" "AccessScope" NOT NULL DEFAULT 'BOTH',
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Role"
ADD COLUMN "scope" "AccessScope" NOT NULL DEFAULT 'BOTH',
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "lockReason" "UserLockReason",
ADD COLUMN "lockedByUserId" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AppScreen" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "area" "AppArea" NOT NULL,
  "group" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AppScreen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionScreen" (
  "permissionId" TEXT NOT NULL,
  "screenId" TEXT NOT NULL,
  CONSTRAINT "PermissionScreen_pkey" PRIMARY KEY ("permissionId","screenId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppScreen_key_key" ON "AppScreen"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AppScreen_path_key" ON "AppScreen"("path");

-- CreateIndex
CREATE INDEX "AppScreen_area_group_sortOrder_idx" ON "AppScreen"("area", "group", "sortOrder");

-- CreateIndex
CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionScreen" ADD CONSTRAINT "PermissionScreen_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionScreen" ADD CONSTRAINT "PermissionScreen_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "AppScreen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
