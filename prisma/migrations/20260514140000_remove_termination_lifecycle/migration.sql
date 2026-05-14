-- SuperNova supports Resignation only. Normalize old data before replacing enums.
UPDATE "Request"
SET "payload" = jsonb_set("payload", '{offboarding,type}', '"RESIGNATION"', false)
WHERE "payload" IS NOT NULL
  AND "payload" #>> '{offboarding,type}' = 'TERMINATION';

UPDATE "Request"
SET "payload" = jsonb_set("payload", '{rehire,previousEmploymentStatus}', '"RESIGNED"', false)
WHERE "payload" IS NOT NULL
  AND "payload" #>> '{rehire,previousEmploymentStatus}' = 'TERMINATED';

UPDATE "Request"
SET "type" = 'RESIGNATION'
WHERE "type" = 'TERMINATION';

UPDATE "User"
SET "employmentStatus" = 'RESIGNED'
WHERE "employmentStatus" = 'TERMINATED';

CREATE TYPE "RequestType_new" AS ENUM ('NEW_HIRE', 'RESIGNATION', 'TRANSFER');

ALTER TABLE "Request"
ALTER COLUMN "type" TYPE "RequestType_new"
USING ("type"::text::"RequestType_new");

DROP TYPE "RequestType";
ALTER TYPE "RequestType_new" RENAME TO "RequestType";

CREATE TYPE "EmploymentStatus_new" AS ENUM ('NEW_HIRE_PENDING', 'ACTIVE', 'RESIGNED', 'ARCHIVED');

ALTER TABLE "User"
ALTER COLUMN "employmentStatus" DROP DEFAULT;

ALTER TABLE "User"
ALTER COLUMN "employmentStatus" TYPE "EmploymentStatus_new"
USING ("employmentStatus"::text::"EmploymentStatus_new");

ALTER TABLE "User"
ALTER COLUMN "employmentStatus" SET DEFAULT 'NEW_HIRE_PENDING';

DROP TYPE "EmploymentStatus";
ALTER TYPE "EmploymentStatus_new" RENAME TO "EmploymentStatus";
