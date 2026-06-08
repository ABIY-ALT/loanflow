-- =============================================================================
-- OPTIONAL DB-LEVEL HARD CONSTRAINT: one active case per customer + department.
-- =============================================================================
-- This is the database backstop behind the application-level guard in
-- src/services/loan-submission-guard.ts (guardActiveCasePerCustomerDepartment).
--
-- It is NOT placed under prisma/migrations/ on purpose: a UNIQUE index CANNOT be
-- created while violating rows exist, and `prisma migrate deploy` would abort the
-- whole deploy if it tried. Apply this MANUALLY, only AFTER the existing
-- duplicate active cases have been cancelled/merged.
--
-- 1) Inspect remaining duplicate active cases:
--
--    SELECT "customerId", "assignedDepartmentId", COUNT(*)
--    FROM "LoanRequest"
--    WHERE "isTerminalStage" = false
--    GROUP BY "customerId", "assignedDepartmentId"
--    HAVING COUNT(*) > 1;
--
--    Resolve every row above (set the redundant ones to a terminal stage) until
--    the query returns zero rows.
--
-- 2) Then run this file. The DO block aborts with a clear error if duplicates
--    still exist, so you never get a half-applied/failed index.
-- =============================================================================

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT 1
    FROM "LoanRequest"
    WHERE "isTerminalStage" = false
      AND "assignedDepartmentId" IS NOT NULL
    GROUP BY "customerId", "assignedDepartmentId"
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create unique index: % customer+department group(s) still have multiple active cases. Resolve them first (see header query).',
      dup_count;
  END IF;
END $$;

-- Partial unique index: at most one non-terminal case per (customer, department).
CREATE UNIQUE INDEX IF NOT EXISTS "LoanRequest_active_case_per_customer_department_key"
  ON "LoanRequest"("customerId", "assignedDepartmentId")
  WHERE "isTerminalStage" = false AND "assignedDepartmentId" IS NOT NULL;
