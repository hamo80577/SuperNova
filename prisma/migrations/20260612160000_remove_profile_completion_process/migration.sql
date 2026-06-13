-- Remove the Picker profile-completion process.
-- Profile status no longer gates any workflow, so every user is treated as
-- COMPLETE and new users default to COMPLETE.

UPDATE "User" SET "profileStatus" = 'COMPLETE' WHERE "profileStatus" <> 'COMPLETE';

ALTER TABLE "User" ALTER COLUMN "profileStatus" SET DEFAULT 'COMPLETE';
