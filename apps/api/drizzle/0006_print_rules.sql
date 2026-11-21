CREATE TABLE "ensemble_print_rules" (
	"ensemble_id" uuid NOT NULL,
	"from_pages" integer NOT NULL,
	"mode" text NOT NULL,
	CONSTRAINT "ensemble_print_rules_ensemble_id_from_pages_pk" PRIMARY KEY("ensemble_id","from_pages"),
	CONSTRAINT "ensemble_print_rules_from_check" CHECK ("ensemble_print_rules"."from_pages" >= 1),
	CONSTRAINT "ensemble_print_rules_mode_check" CHECK ("ensemble_print_rules"."mode" in ('simplex', 'duplex'))
);
--> statement-breakpoint
ALTER TABLE "ensemble_print_rules" ADD CONSTRAINT "ensemble_print_rules_ensemble_id_ensembles_id_fk" FOREIGN KEY ("ensemble_id") REFERENCES "public"."ensembles"("id") ON DELETE cascade ON UPDATE no action;