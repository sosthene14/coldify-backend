import { eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../../shared/db"
import { user } from "../../shared/db/schema"
import { tenantPlugin } from "../../shared/plugins/tenant"
import { paddleService } from "./paddle.service"
import { subscriptions } from "./subscription.schema"
import { subscriptionService } from "./subscription.service"

export const subscriptionController = new Elysia({ prefix: "/subscriptions" })
  .use(tenantPlugin)

  /**
   * Get current organization subscription with plan details
   */
  .get("/current", async ({ tenant }) => {
    const subscription = await subscriptionService.getByOrganization(tenant.organizationId)

    if (!subscription) {
      return {
        error: "No subscription found",
        status: 404,
      }
    }

    return subscription
  })

  /**
   * Get subscription stats (plan, usage, limits)
   */
  .get("/stats", async ({ tenant }) => {
    const stats = await subscriptionService.getStats(tenant.organizationId)

    if (!stats) {
      return {
        error: "No subscription found",
        status: 404,
      }
    }

    return stats
  })

  /**
   * Get all available plans
   */
  .get("/plans", async () => {
    const plans = await subscriptionService.getAllPlans()
    return plans
  })

  /**
   * Check if organization can add a provider
   */
  .get("/can-add-provider", async ({ tenant }) => {
    const result = await subscriptionService.canAddProvider(tenant.organizationId)
    return result
  })

  /**
   * Check if organization has access to a feature
   */
  .get(
    "/features/:feature",
    async ({ tenant, params }) => {
      const hasAccess = await subscriptionService.hasFeature(
        tenant.organizationId,
        params.feature as "priority_support" | "integration_api",
      )

      return {
        feature: params.feature,
        hasAccess,
      }
    },
    {
      params: t.Object({
        feature: t.Union([t.Literal("priority_support"), t.Literal("integration_api")]),
      }),
    },
  )

  /**
   * Get Paddle checkout config for frontend
   */
  .get("/paddle-config", async ({ tenant }) => {
    const plans = await subscriptionService.getAllPlans()

    // Get user email
    const [userData] = await db.select({ email: user.email }).from(user).where(eq(user.id, tenant.userId)).limit(1)

    return {
      clientToken: paddleService.getClientToken(),
      environment: paddleService.getEnvironment(),
      customerEmail: userData?.email || "",
      organizationId: tenant.organizationId,
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceId: p.paddlePriceIdMonthly,
      })),
    }
  })

  /**
   * Ensure default subscription exists (fallback/safety net)
   * Crée une subscription "free" si elle manque
   */
  .post("/ensure-default", async ({ tenant }) => {
    try {
      // Vérifier si subscription existe déjà
       const existing = await subscriptionService.getByOrganization(tenant.organizationId)

      if (existing) {
        return {
          message: "Subscription already exists",
          subscription: existing,
        }
      }

      // Créer la subscription par défaut
      const now = new Date()
      const unlimited = new Date("2099-12-31")

      const [newSubscription] = await db
        .insert(subscriptions)
        .values({
          id: crypto.randomUUID(),
          organizationId: tenant.organizationId,
          planId: "free",
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: unlimited,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

 
      return {
        message: "Default subscription created",
        subscription: newSubscription,
      }
    } catch (error) {
      console.error("[Subscription] Error ensuring default subscription:", error)
      return {
        error: "Failed to create subscription",
        status: 500,
      }
    }
  })
