-- added by hand: needed for the gin_trgm_ops indexes below (D-c); trusted extension, no superuser needed
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('text', 'number', 'date', 'select', 'multiselect', 'link', 'boolean');--> statement-breakpoint
CREATE TABLE "field_definitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "field_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"field_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ensemble_lineup_voices" (
	"ensemble_id" uuid NOT NULL,
	"voice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "ensemble_lineup_voices_ensemble_id_voice_id_pk" PRIMARY KEY("ensemble_id","voice_id"),
	CONSTRAINT "ensemble_lineup_position_unique" UNIQUE("ensemble_id","position")
);
--> statement-breakpoint
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_field_id_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ensemble_lineup_voices" ADD CONSTRAINT "ensemble_lineup_voices_ensemble_id_ensembles_id_fk" FOREIGN KEY ("ensemble_id") REFERENCES "public"."ensembles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ensemble_lineup_voices" ADD CONSTRAINT "ensemble_lineup_voices_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_definitions_name_idx" ON "field_definitions" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "field_options_label_idx" ON "field_options" USING btree ("field_id",lower("label"));--> statement-breakpoint
CREATE INDEX "scores_title_trgm_idx" ON "scores" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "scores_composer_trgm_idx" ON "scores" USING gin ("composer" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "scores_custom_values_idx" ON "scores" USING gin ("custom_values");