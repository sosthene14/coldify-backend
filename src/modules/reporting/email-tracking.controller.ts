import { Elysia } from "elysia"
import { generateTransparentPixel, verifyTrackingToken } from "../../shared/lib/email-tracking"
import { tenantPlugin } from "../../shared/plugins/tenant"
import { emailTrackingService } from "./email-tracking.service"

/**
 * Email Tracking Controller
 *
 * Handles tracking pixel requests for email opens.
 * Uses disguised endpoint to avoid ad blockers: /api/success/:token
 */
export const emailTrackingController = new Elysia({ prefix: "/api" })
  /**
   * Track email open - Public endpoint (no auth required)
   */
  .get("/success/:token", async ({ params, request, set }) => {
    try {
      const { token } = params

      // Verify JWT token
      const trackingData = verifyTrackingToken(token)

      if (!trackingData) {
        console.warn("[Email Tracking] Invalid tracking token")
        // Return pixel anyway to avoid breaking email display
        set.headers["Content-Type"] = "image/gif"
        set.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return generateTransparentPixel()
      }

      // Extract user agent and IP (for analytics)
      const userAgent = request.headers.get("user-agent") || undefined
      const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || undefined

      // Record open event (async, don't wait)
      emailTrackingService
        .recordOpen(
          {
            organizationId: trackingData.organizationId,
            userId: trackingData.userId,
            emailHistoryId: trackingData.emailHistoryId,
            campaignId: trackingData.campaignId,
            leadId: trackingData.leadId,
            recipient: trackingData.recipient,
            userAgent,
            ipAddress,
          },
          trackingData,
        ) // Pass full tracking data
        .catch((error) => {
          console.error("[Email Tracking] Failed to record open:", error)
        })

      // Return 1x1 transparent GIF
      set.headers["Content-Type"] = "image/gif"
      set.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
      set.headers.Pragma = "no-cache"
      set.headers.Expires = "0"

      return generateTransparentPixel()
    } catch (error) {
      console.error("[Email Tracking] Error in tracking endpoint:", error)

      // Always return pixel to avoid breaking email display
      set.headers["Content-Type"] = "image/gif"
      return generateTransparentPixel()
    }
  })

  /**
   * Get open statistics for an email (authenticated)
   * GET /api/track/stats/:emailHistoryId
   */
  .use(tenantPlugin)
  .get("/track/stats/:emailHistoryId", async ({ params }) => {
    const stats = await emailTrackingService.getOpenStats(params.emailHistoryId)
    return stats
  })

  /**
   * Get detailed open events for an email (authenticated)
   * GET /api/track/details/:emailHistoryId
   */
  .get("/track/details/:emailHistoryId", async ({ params }) => {
    const details = await emailTrackingService.getOpenDetails(params.emailHistoryId)
    return details
  })
