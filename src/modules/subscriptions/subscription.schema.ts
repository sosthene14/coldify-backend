import { createId } from "@paralleldrive/cuid2";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {  organization } from "../../shared/db/schema/auth";


export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // "free" | "pro" | "unlimited"
  name: text("name").notNull(), // "Free", "Pro", "Unlimited"

  // Price ID Paddle (pri_xxx) — différent en sandbox et en prod
  paddlePriceIdMonthly: text("paddle_price_id_monthly"),

  // Limites — null = illimité
  emailsPerDay: integer("emails_per_day"), // 5, 100, null
  maxConnectedProviders: integer("max_connected_providers"), // 2, 10, null
  historyDays: integer("history_days"), // 7, null

  hasPrioritySupport: boolean("has_priority_support").default(false).notNull(),
  hasIntegrationApi: boolean("has_integration_api").default(false).notNull(),

  priceCents: integer("price_cents").notNull(), // 0, 500, 1000

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Table : subscriptions
// Une organisation a au plus un abonnement effectif à la fois. Cette table
// est la seule que le webhook handler met à jour — jamais le front.
// ---------------------------------------------------------------------------

export const subscriptions = pgTable("subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id").notNull(),

  planId: text("plan_id").notNull().default("free"), // "free" | "pro" | "unlimited"

  // Statut Paddle — trialing, active, past_due, paused, canceled
  status: text("status").notNull().default("active"),

  // Références Paddle — source de vérité pour tout ce qui touche la facturation
  paddleCustomerId: text("paddle_customer_id"), // ctm_xxx
  paddleSubscriptionId: text("paddle_subscription_id"), // sub_xxx
  paddlePriceId: text("paddle_price_id"), // pri_xxx (plan courant)

  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"), // annulation demandée, accès encore actif jusqu'à currentPeriodEnd
  endedAt: timestamp("ended_at"), // accès effectivement coupé

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Table : subscription_events
// Log brut de chaque webhook Paddle reçu. Sert à l'idempotence (on vérifie
// si l'id de l'event existe déjà avant de le traiter) et à l'audit/debug.
// ---------------------------------------------------------------------------

export const subscriptionEvents = pgTable("subscription_events", {
  id: text("id").primaryKey(), // event_id fourni directement par Paddle
  subscriptionId: text("subscription_id"),

  eventType: text("event_type").notNull(), // "subscription.activated", "transaction.completed", ...
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

  processedAt: timestamp("processed_at"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organization, {
    fields: [subscriptions.organizationId],
    references: [organization.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  events: many(subscriptionEvents),
}));

export const subscriptionEventsRelations = relations(
  subscriptionEvents,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [subscriptionEvents.subscriptionId],
      references: [subscriptions.id],
    }),
  })
);