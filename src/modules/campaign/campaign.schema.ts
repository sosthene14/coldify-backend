import { pgTable, text, timestamp, pgEnum, index, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { calendarEvent, conversation, leadCampaignStatus, member, organization } from "../../shared/db/schema";


export const campaignStatus = pgEnum("campaign_status", [
  "active",
  "draft",
  "completed",
  "archived",
]);

export const campaign = pgTable(
  "campaign",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: campaignStatus("status").default("draft").notNull(),
    starred: boolean().default(false),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // lié au membership (organisation + user), pas directement à user
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
    index("campaign_organizationId_idx").on(table.organizationId),
    index("campaign_createdBy_idx").on(table.createdBy),
  ],
);

export const campaignRelations = relations(campaign, ({ one,many }) => ({
  organization: one(organization, {
    fields: [campaign.organizationId],
    references: [organization.id],
  }),
  leadStatuses: many(leadCampaignStatus),
  conversations: many(conversation),
  calendarEvents: many(calendarEvent),
  creator: one(member, {
    fields: [campaign.createdBy],
    references: [member.id],
  }),
}));