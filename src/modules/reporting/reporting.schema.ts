import { relations } from "drizzle-orm"
import { index, jsonb, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"
import { member, organization } from "../../shared/db/schema/auth"
import { campaign } from "../campaign/campaign.schema"
import { lead } from "../lead/lead.schema"
import { template } from "../template/template.schema"

export const emailEventType = pgEnum("email_event_type", [
  "sent",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "unsubscribed",
  "meeting_booked",
])

// ── Event log brut, source de vérité ─────────────────────────────
export const emailEvent = pgTable(
  "email_event",
  {
    id: text("id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    mailId: text("campaign_id").references(() => campaign.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => lead.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => template.id, {
      onDelete: "set null",
    }),
    memberId: text("member_id").references(() => member.id, {
      onDelete: "set null",
    }),

    type: emailEventType("type").notNull(),
    metadata: jsonb("metadata"),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // PK composite: Timescale exige occurredAt dans toute contrainte unique/PK
    primaryKey({ columns: [table.id, table.occurredAt] }),
    index("email_event_org_occurredAt_idx").on(table.organizationId, table.occurredAt),
    index("email_event_campaignId_idx").on(table.mailId),
    index("email_event_leadId_idx").on(table.leadId),
    index("email_event_memberId_idx").on(table.memberId),
  ],
)

export const emailEventRelations = relations(emailEvent, ({ one }) => ({
  organization: one(organization, {
    fields: [emailEvent.organizationId],
    references: [organization.id],
  }),
  campaign: one(campaign, { fields: [emailEvent.mailId], references: [campaign.id] }),
  lead: one(lead, { fields: [emailEvent.leadId], references: [lead.id] }),
  template: one(template, { fields: [emailEvent.templateId], references: [template.id] }),
  member: one(member, { fields: [emailEvent.memberId], references: [member.id] }),
}))
