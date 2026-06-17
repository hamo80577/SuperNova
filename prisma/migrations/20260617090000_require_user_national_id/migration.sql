DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE "nationalId" IS NULL
       OR btrim("nationalId") = ''
       OR "nationalId" !~ '^[0-9]{14}$'
  ) THEN
    RAISE EXCEPTION 'Cannot require User.nationalId: clean existing users so every row has a 14-digit National ID before applying this migration.';
  END IF;
END $$;

ALTER TABLE "User" ALTER COLUMN "nationalId" SET NOT NULL;

ALTER TABLE "User"
  ADD CONSTRAINT "User_nationalId_format_check"
  CHECK ("nationalId" ~ '^[0-9]{14}$');
