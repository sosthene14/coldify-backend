import { Elysia, t } from "elysia";
import { subscriptionService } from "./subscription.service";
import { paddleService } from "./paddle.service";
import { tenantPlugin } from "../../shared/plugins/tenant";
import { db } from "../../shared/db";
import { user } from "../../shared/db/schema";
import { eq } from "drizzle-orm";

export const subscriptionController = new Elysia({ prefix: "/subscriptions" })
  .use(tenantPlugin)

  /**
   * Get current organization subscription with plan details
   */
  .get("/current", async ({ tenant }) => {
    const subscription = await subscriptionService.getByOrganization(
      tenant.organizationId
    );

    if (!subscription) {
      return {
        error: "No subscription found",
        status: 404,
      };
    }

    return subscription;
  })

  /**
   * Get subscription stats (plan, usage, limits)
   */
  .get("/stats", async ({ tenant }) => {
    const stats = await subscriptionService.getStats(tenant.organizationId);

    if (!stats) {
      return {
        error: "No subscription found",
        status: 404,
      };
    }

    return stats;
  })

  /**
   * Get all available plans
   */
  .get("/plans", async () => {
    const plans = await subscriptionService.getAllPlans();
    return plans;
  })

  /**
   * Check if organization can add a provider
   */
  .get("/can-add-provider", async ({ tenant }) => {
    const result = await subscriptionService.canAddProvider(tenant.organizationId);
    return result;
  })

  /**
   * Check if organization has access to a feature
   */
  .get(
    "/features/:feature",
    async ({ tenant, params }) => {
      const hasAccess = await subscriptionService.hasFeature(
        tenant.organizationId,
        params.feature as "priority_support" | "integration_api"
      );

      return {
        feature: params.feature,
        hasAccess,
      };
    },
    {
      params: t.Object({
        feature: t.Union([t.Literal("priority_support"), t.Literal("integration_api")]),
      }),
    }
  )

  /**
   * Get Paddle checkout config for frontend
   */
  .get("/paddle-config", async ({ tenant }) => {
    const plans = await subscriptionService.getAllPlans();
    
    // Get user email
    const [userData] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, tenant.userId))
      .limit(1);

    return {
      clientToken: paddleService.getClientToken(),
      environment: paddleService.getEnvironment(),
      customerEmail: userData?.email || '',
      organizationId: tenant.organizationId,
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        priceId: p.paddlePriceIdMonthly,
      })),
    };
  });
