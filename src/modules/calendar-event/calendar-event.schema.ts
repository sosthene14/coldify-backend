import { pgTable, text, date, time, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { lead } from "../lead/lead.schema";
import { member, organization } from "../../shared/db/schema/auth";
import { campaign } from "../campaign/campaign.schema";

export const calendarEventType = pgEnum("calendar_event_type", [
  "meeting",
  "task",
  "campaign_start",
  "campaign_end",
  "warmup",
  "pause",
]);

export const calendarEvent = pgTable(
  "calendar_event",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    type: calendarEventType("type").notNull(),
    title: text("title").notNull(),
    eventDate: date("event_date").notNull(), // "YYYY-MM-DD"
    eventTime: time("event_time"), // optionnel, ex: "14:00"
    meta: text("meta"),

    // à qui l'event est assigné (nullable: ex. un "warmup" ou "pause" n'a pas
    // forcément de personne assignée, c'est un event de campagne)
    assigneeId: text("assignee_id").references(() => member.id, {
      onDelete: "set null",
    }),

    // liaisons optionnelles selon le type d'event
    mailId: text("campaign_id").references(() => campaign.id, {
      onDelete: "cascade",
    }),
    leadId: text("lead_id").references(() => lead.id, { onDelete: "cascade" }),

    createdBy: text("created_by")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("calendar_event_org_date_idx").on(table.organizationId, table.eventDate),
    index("calendar_event_assigneeId_idx").on(table.assigneeId),
    index("calendar_event_campaignId_idx").on(table.mailId),
  ],
);

export const calendarEventRelations = relations(calendarEvent, ({ one }) => ({
  organization: one(organization, {
    fields: [calendarEvent.organizationId],
    references: [organization.id],
  }),
  assignee: one(member, {
    fields: [calendarEvent.assigneeId],
    references: [member.id],
  }),
  campaign: one(campaign, {
    fields: [calendarEvent.mailId],
    references: [campaign.id],
  }),
  lead: one(lead, { fields: [calendarEvent.leadId], references: [lead.id] }),
  creator: one(member, {
    fields: [calendarEvent.createdBy],
    references: [member.id],
  }),
}));