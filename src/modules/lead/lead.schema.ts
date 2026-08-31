import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { member, organization } from "../../shared/db/schema/auth";
import { campaign } from "../campaign/campaign.schema";
import { organizationCustomField } from "../organization-custom-field/organization-custom-field.schema";


export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "opened",
  "clicked",
  "replied",
  "interested",
  "not_interested",
  "bounced",
  "unsubscribed",
  "do_not_contact",
]);

export const leadSource = pgEnum("lead_source", [
  "manual",
  "csv_import",
  "apollo",
  "linkedin_scraper",
  "api",
  "form",
  "other",
]);

// ── Lead ───────────────────────────────────────────────────────
export const lead = pgTable(
  "lead",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // "le lead de qui" -> membership, pas user directement (cf. campaign)
    ownerId: text("owner_id").references(() => member.id, {
      onDelete: "set null",
    }),

    // Identité
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    // fullName volontairement absent: calculé à la volée (`${firstName} ${lastName}`)
    email: text("email").notNull(),
    secondaryEmail: text("secondary_email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),

    // Poste / Entreprise
    jobTitle: text("job_title"),
    companyName: text("company_name"),
    companyWebsite: text("company_website"),
    companyDomain: text("company_domain"), // pour dédupliquer par domaine
    industry: text("industry"),
    companySize: text("company_size"), // '1-10' | '11-50' | ...
    linkedinUrl: text("linkedin_url"),
    companyLinkedinUrl: text("company_linkedin_url"),

    // Localisation
    country: text("country"),
    city: text("city"),
    timezone: text("timezone"),

    // Statut & tracking global (le plus avancé toutes campagnes confondues)
    status: leadStatus("status").default("new").notNull(),
    currentSequenceStep: integer("current_sequence_step"),
    lastContactedAt: timestamp("last_contacted_at"),
    lastRepliedAt: timestamp("last_replied_at"),
    emailsSentCount: integer("emails_sent_count").default(0).notNull(),
    emailsOpenedCount: integer("emails_opened_count").default(0).notNull(),
    emailsClickedCount: integer("emails_clicked_count").default(0).notNull(),

    // Enrichissement / scoring
    leadScore: integer("lead_score"),
    tags: text("tags").array().default([]).notNull(),
    source: leadSource("source").default("manual").notNull(),

    // Conformité
    gdprConsent: boolean("gdpr_consent").default(false).notNull(),
    isUnsubscribed: boolean("is_unsubscribed").default(false).notNull(),
    unsubscribedAt: timestamp("unsubscribed_at"),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // dédup par email au sein d'une même organisation
    uniqueIndex("lead_org_email_uidx").on(table.organizationId, table.email),
    index("lead_organizationId_idx").on(table.organizationId),
    index("lead_ownerId_idx").on(table.ownerId),
    index("lead_companyDomain_idx").on(table.companyDomain),
  ],
);

// ── Statut du lead PAR campagne (many-to-many lead <-> campaign) ─
export const leadCampaignStatus = pgTable(
  "lead_campaign_status",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => lead.id, { onDelete: "cascade" }),
    mailId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),

    status: leadStatus("status").default("new").notNull(),
    sequenceStep: integer("sequence_step").default(0).notNull(),
    lastContactedAt: timestamp("last_contacted_at"),
    lastActivityAt: timestamp("last_activity_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("lead_campaign_uidx").on(table.leadId, table.mailId),
    index("lead_campaign_status_leadId_idx").on(table.leadId),
    index("lead_campaign_status_campaignId_idx").on(table.mailId),
  ],
);

// ── Champs personnalisés, valeurs ancrées sur les définitions partagées ──
export const leadCustomField = pgTable(
  "lead_custom_field",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => lead.id, { onDelete: "cascade" }),
    // dénormalisé: filtrer/scoper par org sans jointure vers lead à chaque requête
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // pointe vers la définition partagée (organization_custom_field), plus
    // de clé texte libre -> les champs disponibles sont centralisés par org
    fieldId: text("field_id")
      .notNull()
      .references(() => organizationCustomField.id, { onDelete: "cascade" }),

    value: text("value").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // une seule valeur par champ pour un lead donné
    uniqueIndex("lead_custom_field_lead_field_uidx").on(table.leadId, table.fieldId),
    // recherche "tous les leads de l'org où fieldId=X et value=Y"
    index("lead_custom_field_org_field_value_idx").on(
      table.organizationId,
      table.fieldId,
      table.value,
    ),
  ],
);

export const leadCustomFieldRelations = relations(leadCustomField, ({ one }) => ({
  lead: one(lead, { fields: [leadCustomField.leadId], references: [lead.id] }),
  organization: one(organization, {
    fields: [leadCustomField.organizationId],
    references: [organization.id],
  }),
  field: one(organizationCustomField, {
    fields: [leadCustomField.fieldId],
    references: [organizationCustomField.id],
  }),
}));

export const leadRelations = relations(lead, ({ one, many }) => ({
  organization: one(organization, {
    fields: [lead.organizationId],
    references: [organization.id],
  }),
  owner: one(member, { fields: [lead.ownerId], references: [member.id] }),
  campaignStatuses: many(leadCampaignStatus),
  customFields: many(leadCustomField),
}));

export const leadCampaignStatusRelations = relations(
  leadCampaignStatus,
  ({ one }) => ({
    lead: one(lead, { fields: [leadCampaignStatus.leadId], references: [lead.id] }),
    campaign: one(campaign, {
      fields: [leadCampaignStatus.mailId],
      references: [campaign.id],
    }),
  }),
);