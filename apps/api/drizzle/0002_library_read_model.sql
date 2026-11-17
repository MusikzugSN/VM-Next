CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_voices" (
	"user_id" uuid NOT NULL,
	"voice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "user_voices_user_id_voice_id_pk" PRIMARY KEY("user_id","voice_id")
);
--> statement-breakpoint
CREATE TABLE "voice_substitutes" (
	"voice_id" uuid NOT NULL,
	"substitute_voice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "voice_substitutes_voice_id_substitute_voice_id_pk" PRIMARY KEY("voice_id","substitute_voice_id"),
	CONSTRAINT "voice_substitutes_position_unique" UNIQUE("voice_id","position"),
	CONSTRAINT "voice_substitutes_not_self_check" CHECK ("voice_substitutes"."voice_id" <> "voice_substitutes"."substitute_voice_id")
);
--> statement-breakpoint
CREATE TABLE "voices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"instrument_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"composer" text,
	"arranger" text,
	"publisher" text,
	"publisher_number" text,
	"duration_seconds" integer,
	"custom_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"score_id" uuid NOT NULL,
	"voice_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"page_count" integer NOT NULL,
	"size_bytes" bigint NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sheets_score_voice_unique" UNIQUE("score_id","voice_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ensemble_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"show_in_my_area" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder_entries" (
	"folder_id" uuid NOT NULL,
	"score_id" uuid NOT NULL,
	"number" text NOT NULL,
	"number_sort_key" text NOT NULL,
	CONSTRAINT "folder_entries_folder_id_score_id_pk" PRIMARY KEY("folder_id","score_id"),
	CONSTRAINT "folder_entries_number_unique" UNIQUE("folder_id","number")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ensemble_id" uuid NOT NULL,
	"name" text NOT NULL,
	"show_in_my_area" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setlist_entries" (
	"event_id" uuid NOT NULL,
	"score_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "setlist_entries_event_id_score_id_pk" PRIMARY KEY("event_id","score_id"),
	CONSTRAINT "setlist_entries_position_unique" UNIQUE("event_id","position")
);
--> statement-breakpoint
CREATE TABLE "club_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_club_tags" (
	"score_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "score_club_tags_score_id_tag_id_pk" PRIMARY KEY("score_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "score_personal_tags" (
	"personal_tag_id" uuid NOT NULL,
	"score_id" uuid NOT NULL,
	CONSTRAINT "score_personal_tags_personal_tag_id_score_id_pk" PRIMARY KEY("personal_tag_id","score_id")
);
--> statement-breakpoint
ALTER TABLE "user_voices" ADD CONSTRAINT "user_voices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_voices" ADD CONSTRAINT "user_voices_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_substitutes" ADD CONSTRAINT "voice_substitutes_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_substitutes" ADD CONSTRAINT "voice_substitutes_substitute_voice_id_voices_id_fk" FOREIGN KEY ("substitute_voice_id") REFERENCES "public"."voices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voices" ADD CONSTRAINT "voices_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_score_id_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."scores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ensemble_id_ensembles_id_fk" FOREIGN KEY ("ensemble_id") REFERENCES "public"."ensembles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_entries" ADD CONSTRAINT "folder_entries_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_entries" ADD CONSTRAINT "folder_entries_score_id_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."scores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_ensemble_id_ensembles_id_fk" FOREIGN KEY ("ensemble_id") REFERENCES "public"."ensembles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_entries" ADD CONSTRAINT "setlist_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_entries" ADD CONSTRAINT "setlist_entries_score_id_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."scores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_tags" ADD CONSTRAINT "personal_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_club_tags" ADD CONSTRAINT "score_club_tags_score_id_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."scores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_club_tags" ADD CONSTRAINT "score_club_tags_tag_id_club_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."club_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_personal_tags" ADD CONSTRAINT "score_personal_tags_personal_tag_id_personal_tags_id_fk" FOREIGN KEY ("personal_tag_id") REFERENCES "public"."personal_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_personal_tags" ADD CONSTRAINT "score_personal_tags_score_id_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."scores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_name_idx" ON "instruments" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "voices_name_idx" ON "voices" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "voices_instrument_idx" ON "voices" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "events_ensemble_date_idx" ON "events" USING btree ("ensemble_id","date");--> statement-breakpoint
CREATE INDEX "folder_entries_score_idx" ON "folder_entries" USING btree ("score_id");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_ensemble_name_idx" ON "folders" USING btree ("ensemble_id",lower("name"));--> statement-breakpoint
CREATE INDEX "folders_ensemble_visible_idx" ON "folders" USING btree ("ensemble_id","show_in_my_area");--> statement-breakpoint
CREATE INDEX "setlist_entries_score_idx" ON "setlist_entries" USING btree ("score_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_tags_name_idx" ON "club_tags" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "personal_tags_user_name_idx" ON "personal_tags" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "score_club_tags_tag_idx" ON "score_club_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "score_personal_tags_score_idx" ON "score_personal_tags" USING btree ("score_id");