import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { member, organization } from "../../shared/db/schema";

// Import emailHistory for relation (avoid circular import by using lazy function)
let emailHistory: any;
try {
  emailHistory = require("../email-history/email-history.schema").emailHistory;
} catch {
  // Will be set later when the module is loaded
}

export const template = pgTable(
  "template",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // créateur ET seul autorisé à éditer (avec les admin)
    ownerId: text("owner_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(), // contenu réel de l'email (absent du type frontend fourni)
    category: text("category"),
    language: text("language").default("fr").notNull(),
    preview: text("preview"), // extrait/résumé affiché dans la liste

    // false = visible/utilisable par toute l'org. true = visible par owner + admin seulement
    isPrivate: boolean("is_private").default(false).notNull(),

    // stats agrégées, mises à jour à l'usage (via le service, pas modifiables à la main)
    usageCount: integer("usage_count").default(0).notNull(),
    openRate: real("open_rate"), // null tant qu'il n'a jamais été utilisé
    replyRate: real("reply_rate"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [
    index("template_organizationId_idx").on(table.organizationId),
    index("template_ownerId_idx").on(table.ownerId),
  ],
);

// Favoris: personnel, un member peut star un template qu'il ne possède pas
export const memberStarredTemplate = pgTable(
  "member_starred_template",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_starred_template_uidx").on(table.memberId, table.templateId),
  ],
);

export const templateRelations = relations(template, ({ one, many }) => ({
  organization: one(organization, {
    fields: [template.organizationId],
    references: [organization.id],
  }),
  owner: one(member, { fields: [template.ownerId], references: [member.id] }),
  starredBy: many(memberStarredTemplate),
  //@ts-ignore type mismatch
  emailHistory: many(() => emailHistory),
}));

export const memberStarredTemplateRelations = relations(
  memberStarredTemplate,
  ({ one }) => ({
    member: one(member, {
      fields: [memberStarredTemplate.memberId],
      references: [member.id],
    }),
    template: one(template, {
      fields: [memberStarredTemplate.templateId],
      references: [template.id],
    }),
  }),
);