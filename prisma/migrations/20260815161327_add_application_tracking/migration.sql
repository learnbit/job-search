-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "applicationStatus" TEXT NOT NULL DEFAULT 'not_applied',
ADD COLUMN     "appliedAt" TIMESTAMP(3);
