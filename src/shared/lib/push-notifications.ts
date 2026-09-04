import { eq } from "drizzle-orm"
import webPush from "web-push"
import { db } from "../db"
import { user } from "../db/schema"

// Configure VAPID details
webPush.setVapidDetails(
  process.env.VAPID_MAILTO || "mailto:contact@so-mails.com",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || "",
)

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  data?: Record<string, unknown> | string | number | boolean | null
}

interface PushNotificationResult {
  success: boolean
  error?: string
}

interface WebPushError extends Error {
  statusCode?: number
  body?: string
  headers?: Record<string, string>
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload,
): Promise<PushNotificationResult> {
  try {
    // Get user's push subscriptions from database
    const [userData] = await db
      .select({ pushSubscription: user.pushSubscription })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!userData?.pushSubscription) {
      console.log(`[Push] No subscription found for user: ${userId}`)
      return { success: false, error: "No subscription found" }
    }

    let subscription: PushSubscription
    try {
      subscription = JSON.parse(userData.pushSubscription) as PushSubscription
    } catch (parseError) {
      console.error(`[Push] Invalid subscription format for user: ${userId}`, parseError)
      await db.update(user).set({ pushSubscription: null }).where(eq(user.id, userId))
      return { success: false, error: "Invalid subscription format" }
    }

    // Validate subscription structure
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      console.error(`[Push] Incomplete subscription for user: ${userId}`)
      await db.update(user).set({ pushSubscription: null }).where(eq(user.id, userId))
      return { success: false, error: "Incomplete subscription" }
    }

    // Send notification
    await webPush.sendNotification(subscription, JSON.stringify(payload))

    console.log(`[Push] Notification sent to user: ${userId}`)
    return { success: true }
  } catch (error: unknown) {
    const webPushError = error as WebPushError
    console.error("[Push] Error sending notification:", webPushError)

    // If subscription is expired or invalid, remove it from database
    if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
      console.log(`[Push] Removing invalid subscription for user: ${userId}`)
      await db.update(user).set({ pushSubscription: null }).where(eq(user.id, userId))
      return { success: false, error: "Subscription expired or invalid" }
    }

    return {
      success: false,
      error: webPushError instanceof Error ? webPushError.message : "Unknown error",
    }
  }
}

/**
 * Send push notification to all users in an organization
 */
export async function sendPushToOrganization(
  organizationId: string,
  payload: PushNotificationPayload,
): Promise<{
  totalUsers: number
  successfulSends: number
  failedSends: number
}> {
  try {
    // TODO: Fix this query to properly join with member table
    // Currently this query is incorrect as it filters users by user.id = organizationId
    // It should join with a members table to find users belonging to the organization
    const users = await db
      .select({
        id: user.id,
        pushSubscription: user.pushSubscription,
      })
      .from(user)
    // .innerJoin(member, eq(member.userId, user.id)) // TODO: Add proper join
    // .where(eq(member.organizationId, organizationId))

    const usersWithSubscription = users.filter(
      (u): u is typeof u & { pushSubscription: string } =>
        u.pushSubscription !== null && u.pushSubscription !== undefined,
    )

    const notifications = usersWithSubscription.map((u) => sendPushNotification(u.id, payload))

    const results = await Promise.allSettled(notifications)

    const successfulSends = results.filter((r) => r.status === "fulfilled" && r.value.success).length
    const failedSends = results.length - successfulSends

    console.log(
      `[Push] Sent ${successfulSends}/${usersWithSubscription.length} notifications to organization: ${organizationId}`,
    )

    return {
      totalUsers: usersWithSubscription.length,
      successfulSends,
      failedSends,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Push] Error sending to organization:", errorMessage)
    return {
      totalUsers: 0,
      successfulSends: 0,
      failedSends: 0,
    }
  }
}

/**
 * Validate a push subscription object
 */
export function isValidPushSubscription(subscription: unknown): subscription is PushSubscription {
  if (!subscription || typeof subscription !== "object") {
    return false
  }

  const sub = subscription as PushSubscription

  return (
    typeof sub.endpoint === "string" &&
    sub.endpoint.length > 0 &&
    typeof sub.keys === "object" &&
    sub.keys !== null &&
    typeof sub.keys.p256dh === "string" &&
    sub.keys.p256dh.length > 0 &&
    typeof sub.keys.auth === "string" &&
    sub.keys.auth.length > 0
  )
}
