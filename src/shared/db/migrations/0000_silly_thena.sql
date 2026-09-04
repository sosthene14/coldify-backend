CREATE TYPE "public"."limit_period" AS ENUM('daily', 'monthly', 'total');--> statement-breakpoint
CREATE TYPE "public"."plan_feature" AS ENUM('email_sending', 'campaigns', 'members', 'storage_mb');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('active', 'draft', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('meeting', 'task', 'campaign_start', 'campaign_end', 'warmup', 'pause');--> statement-breakpoint
CREATE TYPE "public"."message_sender" AS ENUM('member', 'lead', 'system');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('interested', 'not_interested', 'question', 'auto_reply', 'ooo');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('manual', 'csv_import', 'apollo', 'linkedin_scraper', 'api', 'form', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'opened', 'clicked', 'replied', 'interested', 'not_interested', 'bounced', 'unsubscribed', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('new_reply', 'meeting_reminder', 'lead_assigned', 'campaign_limit_reached', 'mention', 'system');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'date', 'select');--> statement-breakpoint
CREATE TYPE "public"."email_event_type" AS ENUM('sent', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'meeting_booked');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_name" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"last_name" text,
	"phone_number" text,
	"timezone" text,
	"language" text DEFAULT 'English',
	"notification_preferences" text,
	"two_factor_enabled" boolean DEFAULT false,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plan_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"feature" "plan_feature" NOT NULL,
	"period" "limit_period" NOT NULL,
	"limit_value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "usage_counter" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"feature" "plan_feature" NOT NULL,
	"period_key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_email_quota" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"daily_limit" integer DEFAULT 100 NOT NULL,
	"daily_sent" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp DEFAULT now() NOT NULL,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"monthly_limit" integer,
	"monthly_sent" integer DEFAULT 0 NOT NULL,
	"monthly_reset_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_email_quota_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"starred" boolean DEFAULT false,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" "calendar_event_type" NOT NULL,
	"title" text NOT NULL,
	"event_date" date NOT NULL,
	"event_time" time,
	"meta" text,
	"assignee_id" text,
	"campaign_id" text,
	"lead_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"owner_id" text,
	"last_message_preview" text,
	"last_message_at" timestamp,
	"last_message_from" "message_sender",
	"unread" boolean DEFAULT true NOT NULL,
	"has_attachment" boolean DEFAULT false NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"sentiment" "sentiment",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"sender_type" "message_sender" NOT NULL,
	"sender_member_id" text,
	"subject" text,
	"body" text NOT NULL,
	"has_attachment" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"owner_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"secondary_email" text,
	"phone" text,
	"avatar_url" text,
	"job_title" text,
	"company_name" text,
	"company_website" text,
	"company_domain" text,
	"industry" text,
	"company_size" text,
	"linkedin_url" text,
	"company_linkedin_url" text,
	"country" text,
	"city" text,
	"timezone" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"current_sequence_step" integer,
	"last_contacted_at" timestamp,
	"last_replied_at" timestamp,
	"emails_sent_count" integer DEFAULT 0 NOT NULL,
	"emails_opened_count" integer DEFAULT 0 NOT NULL,
	"emails_clicked_count" integer DEFAULT 0 NOT NULL,
	"lead_score" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"source" "lead_source" DEFAULT 'manual' NOT NULL,
	"gdpr_consent" boolean DEFAULT false NOT NULL,
	"is_unsubscribed" boolean DEFAULT false NOT NULL,
	"unsubscribed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_campaign_status" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"sequence_step" integer DEFAULT 0 NOT NULL,
	"last_contacted_at" timestamp,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_custom_field" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"field_id" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"entity_type" text,
	"entity_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_custom_field" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_event" (
	"id" text NOT NULL,
	"organization_id" text NOT NULL,
	"campaign_id" text,
	"lead_id" text,
	"template_id" text,
	"member_id" text,
	"type" "email_event_type" NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_event_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
CREATE TABLE "member_starred_template" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"template_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"category" text,
	"language" text DEFAULT 'fr' NOT NULL,
	"preview" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"open_rate" real,
	"reply_rate" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mailbox" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"email" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_username" text,
	"smtp_password" text,
	"smtp_secure" boolean DEFAULT true,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp,
	"daily_limit" integer DEFAULT 10 NOT NULL,
	"daily_sent" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp DEFAULT now() NOT NULL,
	"warmup_enabled" boolean DEFAULT false NOT NULL,
	"warmup_progress" integer DEFAULT 0 NOT NULL,
	"warmup_start_date" timestamp,
	"signature" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_history" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"mailbox_id" text NOT NULL,
	"template_id" text,
	"from" text NOT NULL,
	"to" json NOT NULL,
	"cc" json,
	"bcc" json,
	"subject" text NOT NULL,
	"snippet" text NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"attachment_names" json,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"total_opens" integer DEFAULT 0 NOT NULL,
	"unique_opens" integer DEFAULT 0 NOT NULL,
	"first_opened_at" timestamp,
	"last_opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"mailbox_id" text NOT NULL,
	"to" jsonb NOT NULL,
	"cc" jsonb,
	"bcc" jsonb,
	"subject" text NOT NULL,
	"snippet" text NOT NULL,
	"text_content" text,
	"reply_to" text,
	"template_id" text,
	"has_attachments" boolean DEFAULT false,
	"attachment_count" integer DEFAULT 0,
	"attachments" jsonb,
	"scheduled_at" timestamp NOT NULL,
	"timezone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"job_id" text,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"paddle_price_id_monthly" text,
	"emails_per_day" integer,
	"max_connected_providers" integer,
	"history_days" integer,
	"has_priority_support" boolean DEFAULT false NOT NULL,
	"has_integration_api" boolean DEFAULT false NOT NULL,
	"price_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"paddle_customer_id" text,
	"paddle_subscription_id" text,
	"paddle_price_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_limit" ADD CONSTRAINT "plan_limit_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counter" ADD CONSTRAINT "usage_counter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_email_quota" ADD CONSTRAINT "organization_email_quota_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_created_by_member_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_assignee_id_member_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_created_by_member_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_member_id_member_id_fk" FOREIGN KEY ("sender_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_campaign_status" ADD CONSTRAINT "lead_campaign_status_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_campaign_status" ADD CONSTRAINT "lead_campaign_status_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_custom_field" ADD CONSTRAINT "lead_custom_field_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_custom_field" ADD CONSTRAINT "lead_custom_field_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_custom_field" ADD CONSTRAINT "lead_custom_field_field_id_organization_custom_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."organization_custom_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_member_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_custom_field" ADD CONSTRAINT "organization_custom_field_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_custom_field" ADD CONSTRAINT "organization_custom_field_created_by_member_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_starred_template" ADD CONSTRAINT "member_starred_template_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_starred_template" ADD CONSTRAINT "member_starred_template_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_owner_id_member_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox" ADD CONSTRAINT "mailbox_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox" ADD CONSTRAINT "mailbox_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_mailbox_id_mailbox_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_limit_uidx" ON "plan_limit" USING btree ("plan_id","feature","period");--> statement-breakpoint
CREATE INDEX "subscription_organizationId_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_counter_uidx" ON "usage_counter" USING btree ("organization_id","feature","period_key");--> statement-breakpoint
CREATE INDEX "organization_email_quota_org_id_idx" ON "organization_email_quota" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "campaign_organizationId_idx" ON "campaign" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "campaign_createdBy_idx" ON "campaign" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "folder_org_name_uidx" ON "folder" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "calendar_event_org_date_idx" ON "calendar_event" USING btree ("organization_id","event_date");--> statement-breakpoint
CREATE INDEX "calendar_event_assigneeId_idx" ON "calendar_event" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "calendar_event_campaignId_idx" ON "calendar_event" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_lead_campaign_uidx" ON "conversation" USING btree ("lead_id","campaign_id");--> statement-breakpoint
CREATE INDEX "conversation_organizationId_idx" ON "conversation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversation_ownerId_idx" ON "conversation" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "conversation_org_unread_idx" ON "conversation" USING btree ("organization_id","unread");--> statement-breakpoint
CREATE INDEX "message_conversationId_idx" ON "message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "message_organizationId_idx" ON "message" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_org_email_uidx" ON "lead" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "lead_organizationId_idx" ON "lead" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lead_ownerId_idx" ON "lead" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "lead_companyDomain_idx" ON "lead" USING btree ("company_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_campaign_uidx" ON "lead_campaign_status" USING btree ("lead_id","campaign_id");--> statement-breakpoint
CREATE INDEX "lead_campaign_status_leadId_idx" ON "lead_campaign_status" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_campaign_status_campaignId_idx" ON "lead_campaign_status" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_custom_field_lead_field_uidx" ON "lead_custom_field" USING btree ("lead_id","field_id");--> statement-breakpoint
CREATE INDEX "lead_custom_field_org_field_value_idx" ON "lead_custom_field" USING btree ("organization_id","field_id","value");--> statement-breakpoint
CREATE INDEX "notification_recipient_read_idx" ON "notification" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "notification_recipient_createdAt_idx" ON "notification" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_organizationId_idx" ON "notification" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_custom_field_org_name_uidx" ON "organization_custom_field" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "org_custom_field_organizationId_idx" ON "organization_custom_field" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_event_org_occurredAt_idx" ON "email_event" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_event_campaignId_idx" ON "email_event" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "email_event_leadId_idx" ON "email_event" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "email_event_memberId_idx" ON "email_event" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_starred_template_uidx" ON "member_starred_template" USING btree ("member_id","template_id");--> statement-breakpoint
CREATE INDEX "template_organizationId_idx" ON "template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "template_ownerId_idx" ON "template" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "mailbox_organizationId_idx" ON "mailbox" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mailbox_memberId_idx" ON "mailbox" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "mailbox_email_idx" ON "mailbox" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_history_organizationId_idx" ON "email_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_history_memberId_idx" ON "email_history" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "email_history_mailboxId_idx" ON "email_history" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "email_history_templateId_idx" ON "email_history" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "email_history_sentAt_idx" ON "email_history" USING btree ("sent_at");