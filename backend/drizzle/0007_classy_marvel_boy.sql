CREATE TABLE "gallery_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_attendees" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_hosts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_speakers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_content" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "event_attendees" CASCADE;--> statement-breakpoint
DROP TABLE "event_hosts" CASCADE;--> statement-breakpoint
DROP TABLE "event_speakers" CASCADE;--> statement-breakpoint
DROP TABLE "site_content" CASCADE;--> statement-breakpoint
ALTER TABLE "events" RENAME COLUMN "registration_url" TO "external_url";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "timezone" varchar(64) DEFAULT 'Asia/Manila' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_collections" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "media_collections" ADD CONSTRAINT "media_collections_category_id_gallery_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."gallery_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "registration_enabled";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "is_featured";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "display_order";--> statement-breakpoint
-- Seed default gallery categories (no seed harness exists, so the INSERTs
-- live in this migration; idempotent via ON CONFLICT for safe re-runs).
INSERT INTO "gallery_categories" ("id", "name", "slug", "display_order", "is_active", "created_at", "updated_at") VALUES
	(gen_random_uuid(), 'Events', 'events', 0, true, now(), now()),
	(gen_random_uuid(), 'Workshops', 'workshops', 1, true, now(), now()),
	(gen_random_uuid(), 'Community', 'community', 2, true, now(), now())
ON CONFLICT ("slug") DO NOTHING;