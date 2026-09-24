CREATE TABLE "admin_bootstrap" (
	"id" integer PRIMARY KEY NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now(),
	"claimed_by" text,
	CONSTRAINT "admin_bootstrap_singleton_chk" CHECK ("admin_bootstrap"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "admin_bootstrap" ADD CONSTRAINT "admin_bootstrap_claimed_by_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;