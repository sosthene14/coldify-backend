import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";

// Chaque métrique que tu veux limiter/tracker. Ajoute-en une = pas de migration
// pour les tables plan_limit/usage_counter, juste une nouvelle valeur d'enum.
export const planFeature = pgEnum("plan_feature", [
  "email_sending",
  "campaigns",
  "members",
  "storage_mb",
]);

export const limitPeriod = pgEnum("limit_period", ["daily", "monthly", "total"]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

// ── Plans (Free, Pro, Enterprise...) ────────────────────────────
export const plan = pgTable("plan", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Limites par plan, par feature, par période ──────────────────
// limitValue = -1 convention pour "illimité"
export const planLimit = pgTable(
  "plan_limit",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    feature: planFeature("feature").notNull(),
    period: limitPeriod("period").notNull(),
    limitValue: integer("limit_value").notNull(),
  },
  (table) => [
    uniqueIndex("plan_limit_uidx").on(table.planId, table.feature, table.period),
  ],
);

// ── Abonnement actif d'une organisation ──────────────────────────
export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .unique() // une seule souscription active par org
      .references(() => organization.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "restrict" }),
    status: subscriptionStatus("status").default("active").notNull(),
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("subscription_organizationId_idx").on(table.organizationId)],
);

// ── Consommation réelle, bucketée par période ────────────────────
// periodKey: "2026-07-29" (daily), "2026-07" (monthly), "total" (total)
// -> pas besoin de reset cron, chaque nouveau jour/mois crée naturellement
//    une nouvelle ligne avec un nouveau periodKey.
export const usageCounter = pgTable(
  "usage_counter",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    feature: planFeature("feature").notNull(),
    periodKey: text("period_key").notNull(),
    count: integer("count").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_counter_uidx").on(
      table.organizationId,
      table.feature,
      table.periodKey,
    ),
  ],
);

export const planRelations = relations(plan, ({ many }) => ({
  limits: many(planLimit),
  subscriptions: many(subscription),
}));

export const planLimitRelations = relations(planLimit, ({ one }) => ({
  plan: one(plan, { fields: [planLimit.planId], references: [plan.id] }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  organization: one(organization, {
    fields: [subscription.organizationId],
    references: [organization.id],
  }),
  plan: one(plan, { fields: [subscription.planId], references: [plan.id] }),
}));

export const usageCounterRelations = relations(usageCounter, ({ one }) => ({
  organization: one(organization, {
    fields: [usageCounter.organizationId],
    references: [organization.id],
  }),
}));