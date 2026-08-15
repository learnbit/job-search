-- Add nullable delivery state without a default so future jobs remain pending.
ALTER TABLE "Job"
ADD COLUMN "telegramNotifiedAt" TIMESTAMP(3);

-- Treat the existing database baseline as already handled.
UPDATE "Job"
SET "telegramNotifiedAt" = CURRENT_TIMESTAMP;
