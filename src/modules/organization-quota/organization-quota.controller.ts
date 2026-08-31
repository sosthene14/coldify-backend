import { Elysia, t } from "elysia";
import { organizationQuotaService } from "./organization-quota.service";
import { tenantPlugin } from "../../shared/plugins/tenant";

export const organizationQuotaController = new Elysia({ prefix: "/quota" })
  .use(tenantPlugin)

  /**
   * Get organization email quota stats
   */
  .get("/", async ({ tenant }) => {
    const stats = await organizationQuotaService.getStats(tenant.organizationId);
    return stats;
  })

  /**
   * Update organization email limits (admin only)
   */
  .patch(
    "/limits",
    async ({ tenant, body }) => {
      //@ts-ignore type mismatch
      if (tenant.role !== "owner" && tenant.role !== "admin") {
        return {
          error: "Unauthorized. Only admins can update email limits.",
          status: 403,
        };
      }

      const updated = await organizationQuotaService.updateLimits(
        tenant.organizationId,
        body
      );

      if (!updated) {
        return {
          error: "Failed to update limits",
          status: 500,
        };
      }

      return {
        success: true,
        quota: updated,
      };
    },
    {
      body: t.Object({
        dailyLimit: t.Optional(t.Number({ minimum: 1 })),
        monthlyLimit: t.Optional(t.Union([t.Number({ minimum: 1 }), t.Null()])),
      }),
    }
  );
