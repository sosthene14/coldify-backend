import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { organization, user } from "../../shared/db/schema/auth"

export const folder = pgTable(
  "folder",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("folder_org_name_uidx").on(table.organizationId, table.name)],
)

export const folderRelations = relations(folder, ({ one }) => ({
  organization: one(organization, {
    fields: [folder.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [folder.createdBy],
    references: [user.id],
  }),
}))
