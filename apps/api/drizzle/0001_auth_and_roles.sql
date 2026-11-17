CREATE TYPE "public"."user_status" AS ENUM('active', 'blocked');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"oidc_sub" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"picture_url" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_oidc_sub_unique" UNIQUE("oidc_sub")
);
--> statement-breakpoint
CREATE TABLE "ensembles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"is_root" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ensembles_root_check" CHECK ("ensembles"."is_root" = ("ensembles"."parent_id" is null))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission"),
	CONSTRAINT "role_permissions_known_check" CHECK ("role_permissions"."permission" in ('score.view', 'score.create', 'score.edit', 'score.delete', 'voice.view', 'voice.create', 'voice.edit', 'voice.delete', 'tag.view', 'tag.create', 'tag.edit', 'tag.delete', 'folder.view', 'folder.create', 'folder.edit', 'folder.delete', 'event.view', 'event.create', 'event.edit', 'event.delete', 'user.view', 'user.create', 'user.edit', 'user.delete', 'role.view', 'role.create', 'role.edit', 'role.delete', 'ensemble.view', 'ensemble.create', 'ensemble.edit', 'ensemble.delete', 'sheet.upload', 'sheet.approve', 'member.view', 'config.view', 'config.edit'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"default_key" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_default_key_unique" UNIQUE("default_key")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"ensemble_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_ensemble_id_pk" PRIMARY KEY("user_id","ensemble_id")
);
--> statement-breakpoint
CREATE TABLE "club_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"club_name" text NOT NULL,
	"imprint_url" text,
	"privacy_url" text,
	"login_banner" text,
	"login_auto_redirect" boolean DEFAULT false NOT NULL,
	"logo_file_key" text,
	"logo_mime" text,
	"default_ensemble_id" uuid,
	"default_role_id" uuid,
	"browser_print_page_limit" integer DEFAULT 10 NOT NULL,
	"public_base_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_settings_single_row_check" CHECK ("club_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "ensembles" ADD CONSTRAINT "ensembles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ensembles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_ensemble_id_ensembles_id_fk" FOREIGN KEY ("ensemble_id") REFERENCES "public"."ensembles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_settings" ADD CONSTRAINT "club_settings_default_ensemble_id_ensembles_id_fk" FOREIGN KEY ("default_ensemble_id") REFERENCES "public"."ensembles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_settings" ADD CONSTRAINT "club_settings_default_role_id_roles_id_fk" FOREIGN KEY ("default_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "ensembles_single_root_idx" ON "ensembles" USING btree ("is_root") WHERE "ensembles"."is_root";--> statement-breakpoint
CREATE UNIQUE INDEX "ensembles_parent_name_idx" ON "ensembles" USING btree ("parent_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_idx" ON "roles" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "memberships_ensemble_idx" ON "memberships" USING btree ("ensemble_id");--> statement-breakpoint
CREATE INDEX "memberships_role_idx" ON "memberships" USING btree ("role_id");