ALTER TABLE "appointments" ADD COLUMN "location_type" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "address" jsonb;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "location_type" text DEFAULT 'at_master' NOT NULL;