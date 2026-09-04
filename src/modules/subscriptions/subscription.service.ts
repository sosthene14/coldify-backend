import { createId } from "@paralleldrive/cuid2"
import { eq, sql } from "drizzle-orm"
import { db } from "../../shared/db"
import { mailbox } from "../mailbox"
import { plans, subscriptions } from "./subscription.schema"

export interface SubscriptionWithPlan {
  id: string
  organizationId: string
  planId: string
  status: string
  paddleCustomerId: string | null
  paddleSubscriptionId: string | null
  paddlePriceId: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  canceledAt: Date | null
  endedAt: Date | null
  createdAt: Date
  updatedAt: Date
  plan: {
    id: string
    name: string
    emailsPerDay: number | null
    maxConnectedProviders: number | null
    historyDays: number | null
    hasPrioritySupport: boolean
    hasIntegrationApi: boolean
    priceCents: number
  }
}

export const subscriptionService = {
  /**
   * Get subscription with plan details for an organization
   */
  async getByOrganization(organizationId: string): Promise<SubscriptionWithPlan | null> {
    const [result] = await db
      .select({
        id: subscriptions.id,
        organizationId: subscriptions.organizationId,
        planId: subscriptions.planId,
        status: subscriptions.status,
        paddleCustomerId: subscriptions.paddleCustomerId,
        paddleSubscriptionId: subscriptions.paddleSubscriptionId,
        paddlePriceId: subscriptions.paddlePriceId,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        canceledAt: subscriptions.canceledAt,
        endedAt: subscriptions.endedAt,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        plan: {
          id: plans.id,
          name: plans.name,
          emailsPerDay: plans.emailsPerDay,
          maxConnectedProviders: plans.maxConnectedProviders,
          historyDays: plans.historyDays,
          hasPrioritySupport: plans.hasPrioritySupport,
          hasIntegrationApi: plans.hasIntegrationApi,
          priceCents: plans.priceCents,
        },
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1)

    //@ts-expect-error type mismatch
    return result || null
  },

  /**
   * Create a free subscription for a new organization
   */
  async createFreeSubscription(organizationId: string) {
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        id: createId(),
        organizationId,
        planId: "free",
        status: "active",
      })
      .returning()

    return newSubscription
  },

  /**
   * Check if organization can add more providers
   */
  async canAddProvider(organizationId: string): Promise<{
    allowed: boolean
    reason?: string
    currentCount?: number
    maxAllowed?: number | null
  }> {
    const subscription = await this.getByOrganization(organizationId)

    if (!subscription) {
      return {
        allowed: false,
        reason: "No active subscription found",
      }
    }

    const maxProviders = subscription.plan.maxConnectedProviders

    // null = unlimited
    if (maxProviders === null) {
      return { allowed: true, maxAllowed: null }
    }

    const currentProviders = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(mailbox)
      .where(eq(mailbox.organizationId, organizationId))

    const currentCount = currentProviders[0]?.count || 0

    if (currentCount >= maxProviders) {
      return {
        allowed: false,
        reason: `Provider limit reached. Your ${subscription.plan.name} plan allows ${maxProviders} provider(s).`,
        currentCount,
        maxAllowed: maxProviders,
      }
    }

    return {
      allowed: true,
      currentCount,
      maxAllowed: maxProviders,
    }
  },

  /**
   * Get email quota limits from subscription plan
   */
  async getEmailLimits(organizationId: string): Promise<{
    dailyLimit: number
    monthlyLimit: number | null
  }> {
    const subscription = await this.getByOrganization(organizationId)

    if (!subscription) {
      // Fallback to free plan limits
      return {
        dailyLimit: 5,
        monthlyLimit: null,
      }
    }

    const dailyLimit = subscription.plan.emailsPerDay || 10000 // 10k pour illimité
    const monthlyLimit = subscription.plan.emailsPerDay ? subscription.plan.emailsPerDay * 30 : null

    return {
      dailyLimit,
      monthlyLimit,
    }
  },

  /**
   * Check if organization has access to a feature
   */
  async hasFeature(organizationId: string, feature: "priority_support" | "integration_api"): Promise<boolean> {
    const subscription = await this.getByOrganization(organizationId)

    if (!subscription) {
      return false
    }

    switch (feature) {
      case "priority_support":
        return subscription.plan.hasPrioritySupport
      case "integration_api":
        return subscription.plan.hasIntegrationApi
      default:
        return false
    }
  },

  /**
   * Get all plans
   */
  async getAllPlans() {
    return await db.select().from(plans)
  },

  /**
   * Get provider count for organization
   */
  async getProviderCount(organizationId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(mailbox)
      .where(eq(mailbox.organizationId, organizationId))

    return result[0]?.count || 0
  },

  /**
   * Get subscription stats
   */
  async getStats(organizationId: string) {
    const subscription = await this.getByOrganization(organizationId)

    if (!subscription) {
      return null
    }

    const providerCount = await this.getProviderCount(organizationId)
    const canAddProviderCheck = await this.canAddProvider(organizationId)

    return {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      providers: {
        current: providerCount,
        max: subscription.plan.maxConnectedProviders,
        canAdd: canAddProviderCheck.allowed,
      },
      features: {
        prioritySupport: subscription.plan.hasPrioritySupport,
        integrationApi: subscription.plan.hasIntegrationApi,
      },
    }
  },
}
