ALTER TABLE "member_terms" ADD COLUMN "profile_media_id" uuid;--> statement-breakpoint
UPDATE "member_terms"
SET "profile_media_id" = "team_members"."profile_media_id"
FROM "team_members"
WHERE "member_terms"."member_id" = "team_members"."id"
  AND "member_terms"."profile_media_id" IS NULL
  AND "team_members"."profile_media_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "member_terms" ADD CONSTRAINT "member_terms_profile_media_id_media_id_fk" FOREIGN KEY ("profile_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;
