import { relations } from "drizzle-orm"
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { member, organization } from "../../shared/db/schema"

export const customFieldType = pgEnum("custom_field_type", ["text", "date", "select"])

export const organizationCustomField = pgTable(
  "organization_custom_field",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    name: text("name").notNull(), // "Department", "Annual Revenue", "Deal Stage"...
    fieldType: customFieldType("field_type").notNull(),

    // uniquement pour fieldType = "select": la liste des choix
    options: jsonb("options").$type<string[]>(),

    isRequired: boolean("is_required").default(false).notNull(),
    position: integer("position").default(0).notNull(), // ordre d'affichage

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
    uniqueIndex("org_custom_field_org_name_uidx").on(table.organizationId, table.name),
    index("org_custom_field_organizationId_idx").on(table.organizationId),
  ],
)

export const organizationCustomFieldRelations = relations(organizationCustomField, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationCustomField.organizationId],
    references: [organization.id],
  }),
  creator: one(member, {
    fields: [organizationCustomField.createdBy],
    references: [member.id],
  }),
}))
