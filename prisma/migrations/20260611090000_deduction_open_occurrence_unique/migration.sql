-- Remove the unused WARNING value from RequestType. It was added by an earlier
-- migration during an abandoned design iteration (warnings are represented by
-- DeductionPenaltyType.WARNING inside a DeductionCase) and is referenced by no
-- workflow, guard, UI, or test. Postgres cannot DROP an enum value in place, so
-- the type is rebuilt without it.
ALTER TYPE "RequestType" RENAME TO "RequestType_old";
CREATE TYPE "RequestType" AS ENUM ('NEW_HIRE', 'RESIGNATION', 'TRANSFER', 'DEDUCTION');
ALTER TABLE "Request"
  ALTER COLUMN "type" TYPE "RequestType" USING ("type"::text::"RequestType");
DROP TYPE "RequestType_old";

-- Guarantee that two concurrent deduction submissions for the same
-- target + action + month can never both persist the same occurrence number.
-- Scoped to open statuses so rejected/cancelled cases free their slot.
CREATE UNIQUE INDEX "DeductionCase_open_occurrence_key"
  ON "DeductionCase" ("targetUserId", "actionId", "incidentMonth", "occurrenceNumber")
  WHERE "status" IN ('PENDING_APPROVAL', 'EFFECTIVE');
