-- Re-assert the 3 default gallery categories from 0007 (Events/events/0,
-- Workshops/workshops/1, Community/community/2). Data-only migration:
-- idempotent via ON CONFLICT (slug) DO NOTHING, so re-running never
-- duplicates rows or overwrites admin edits (renames, reorder, deactivation).
INSERT INTO "gallery_categories" ("name", "slug", "display_order", "is_active") VALUES
  ('Events', 'events', 0, true),
  ('Workshops', 'workshops', 1, true),
  ('Community', 'community', 2, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
