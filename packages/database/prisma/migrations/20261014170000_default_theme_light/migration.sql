-- Light is the default theme now; anyone who wants dark switches it themselves.
ALTER TABLE "tenants" ALTER COLUMN "theme" SET DEFAULT 'LIGHT';

-- Existing businesses move to the new default too.
UPDATE "tenants" SET "theme" = 'LIGHT' WHERE "theme" = 'DARK';
