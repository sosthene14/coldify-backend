import { Elysia, t } from "elysia"
import { tenantPlugin } from "../../shared/plugins/tenant"
import { emailHistoryService } from "./email-history.service"

export const emailHistoryController = new Elysia({ prefix: "/email-history" })
  .use(tenantPlugin)

  /**
   * List email history
   */
  .get(
    "/",
    async ({ tenant, query }) => {
      const result = await emailHistoryService.list(tenant.organizationId, {
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        memberId: query.memberId,
        mailboxId: query.mailboxId,
      })

      return result
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        memberId: t.Optional(t.String()),
        mailboxId: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Get email by ID
   */
  .get("/:id", async ({ params, tenant }) => {
    const email = await emailHistoryService.getById(params.id, tenant.organizationId)

    if (!email) {
      return {
        error: "Email not found",
        status: 404,
      }
    }

    return email
  })

  /**
   * Get statistics
   */
  .get("/stats/summary", async ({ tenant }) => {
    const stats = await emailHistoryService.getStats(tenant.organizationId)
    return stats
  })

  /**
   * Delete email history
   */
  .delete("/:id", async ({ params, tenant }) => {
    const email = await emailHistoryService.getById(params.id, tenant.organizationId)

    if (!email) {
      return {
        success: false,
        error: "Email not found",
      }
    }

    const deleted = await emailHistoryService.delete(params.id, tenant.organizationId)

    if (!deleted) {
      return {
        success: false,
        error: "Failed to delete email",
      }
    }

    return {
      success: true,
      message: "Email deleted successfully",
    }
  })

  .get("/:id/content", async ({ params, tenant, set }) => {
    const email = await emailHistoryService.getById(params.id, tenant.organizationId)

    if (!email) {
      set.status = 404
      return { error: "Email not found" }
    }

    try {
      const htmlContent = emailHistoryService.getDecryptedContent(email)

      return { htmlContent }
    } catch (_err) {
      set.status = 502
      return { error: "Failed to fetch email content" }
    }
  })
