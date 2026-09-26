-- Seed the default school-year range (S.Y. 2023-2024 … 2029-2030).
-- Data-only migration: idempotent via ON CONFLICT (name) DO NOTHING, so
-- re-running (or deploying over an DB that already has some of these rows)
-- never duplicates or overwrites admin edits.
INSERT INTO "terms" ("name", "start_date", "end_date", "is_current") VALUES
  ('2023-2024', '2023-08-01', '2024-07-31', false),
  ('2024-2025', '2024-08-01', '2025-07-31', false),
  ('2025-2026', '2025-08-01', '2026-07-31', false),
  ('2026-2027', '2026-08-01', '2027-07-31', false),
  ('2027-2028', '2027-08-01', '2028-07-31', false),
  ('2028-2029', '2028-08-01', '2029-07-31', false),
  ('2029-2030', '2029-08-01', '2030-07-31', false)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- Promote the latest term only when nothing is current: an existing
-- isCurrent pick always wins over the seed default.
UPDATE "terms" SET "is_current" = true, "updated_at" = NOW()
WHERE "name" = '2029-2030'
  AND NOT EXISTS (SELECT 1 FROM "terms" WHERE "is_current" = true AND "name" <> '2029-2030');--> statement-breakpoint
