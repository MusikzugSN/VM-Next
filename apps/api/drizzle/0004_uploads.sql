CREATE TYPE "public"."upload_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uploaded_by" uuid,
	"file_name" text NOT NULL,
	"file_key" text,
	"page_count" integer NOT NULL,
	"size_bytes" bigint NOT NULL,
	"score_id" uuid,
	"voice_id" uuid,
	"status" "upload_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sheets" ADD COLUMN "upload_id" uuid;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_score_id_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."scores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_status_created_idx" ON "uploads" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "uploads_uploader_idx" ON "uploads" USING btree ("uploaded_by","created_at");--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;