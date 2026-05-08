-- Phase 3: enforce one active assignment at the database layer.
-- Prisma schema syntax cannot express PostgreSQL partial unique indexes.

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_picker_branch_assignment"
ON "PickerBranchAssignment" ("pickerId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_vendor_champ_assignment"
ON "VendorChampAssignment" ("vendorId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_chain_area_manager_assignment"
ON "ChainAreaManagerAssignment" ("chainId")
WHERE "status" = 'ACTIVE';
