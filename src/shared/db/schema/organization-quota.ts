import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const organizationEmailQuota = pgTable(
  "organization_email_quota",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
      .unique(),

    // Daily limits
    dailyLimit: integer("daily_limit").notNull().default(100),
    dailySent: integer("daily_sent").notNull().default(0),
    lastResetAt: timestamp("last_reset_at").notNull().defaultNow(),

    // Total counters (historical)
    totalSent: integer("total_sent").notNull().default(0),

    // Monthly counters (for billing)
    monthlyLimit: integer("monthly_limit"), // NULL = unlimited
    monthlySent: integer("monthly_sent").notNull().default(0),
    monthlyResetAt: timestamp("monthly_reset_at").notNull().defaultNow(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("organization_email_quota_org_id_idx").on(table.organizationId)]
);

export const organizationEmailQuotaRelations = relations(
  organizationEmailQuota,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationEmailQuota.organizationId],
      references: [organization.id],
    }),
  })
);

export type OrganizationEmailQuota = typeof organizationEmailQuota.$inferSelect;
export type InsertOrganizationEmailQuota = typeof organizationEmailQuota.$inferInsert;
