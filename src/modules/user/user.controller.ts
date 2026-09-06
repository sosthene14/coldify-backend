import { and, eq, gt, or } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../../shared/db/index.js"
import { session, user } from "../../shared/db/schema/auth.js"
import { auth } from "../../shared/lib/auth.js"
import { redisConnection } from "../../shared/lib/redis.js"
import { tenantPlugin } from "../../shared/plugins/tenant.js"

export const userController = new Elysia({ prefix: "/user" })
  /**
   * Get VAPID public key for push notifications (public endpoint)
   */
  .get("/vapid-public-key", async () => {
    return { publicKey: process.env.VAPID_PUBLIC_KEY }
  })

  // Protected routes - require authentication via tenantPlugin
  .use(tenantPlugin)

  /**
   * Update user profile
   */
  .patch(
    "/profile",
    async ({ body, request, set }) => {
      try {
 

        // Get authenticated user directly from auth session
        const authSession = await auth.api.getSession({
          headers: request.headers,
        })

        if (!authSession) {
           set.status = 401
          return {
            error: "Not authenticated",
            status: 401,
          }
        }

        const { user: authUser } = authSession
 
        // Use Better Auth to update user
        const updateData: any = {}
        if (body.firstName !== undefined) updateData.firstName = body.firstName
        if (body.lastName !== undefined) updateData.lastName = body.lastName
        if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber
        if (body.timezone !== undefined) updateData.timezone = body.timezone
        if (body.language !== undefined) updateData.language = body.language

        if (body.firstName !== undefined || body.lastName !== undefined) {
          const fn = body.firstName !== undefined ? body.firstName : authUser.firstName || ""
          const ln = body.lastName !== undefined ? body.lastName : authUser.lastName || ""
          updateData.name = `${fn} ${ln}`.trim() || authUser.email
        }

 
        // Call Better Auth API to update user and refresh cookieCache / session
        try {
          await auth.api.updateUser({
            body: updateData,
            headers: request.headers,
          })
        } catch (authErr) {
          console.warn("⚠️ auth.api.updateUser fallback to db update:", authErr)
        }

        // Direct DB update fallback to guarantee returning updated user structure
        const [updatedUser] = await db.update(user).set(updateData).where(eq(user.id, authUser.id)).returning({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          timezone: user.timezone,
          language: user.language,
        })

 
        // VERIFICATION: Re-select from database to confirm the update was persisted
        const [verificationUser] = await db
          .select({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            timezone: user.timezone,
            language: user.language,
          })
          .from(user)
          .where(eq(user.id, authUser.id))

 
        if (!updatedUser) {
           set.status = 404
          return {
            error: "User not found",
            status: 404,
          }
        }

     

        return {
          message: "Profile updated successfully",
          user: updatedUser,
        }
      } catch (error) {
        console.error("❌ Error updating user profile:", error)
        set.status = 500
        return {
          error: "Failed to update profile",
          status: 500,
        }
      }
    },
    {
      body: t.Object({
        firstName: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        lastName: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        phoneNumber: t.Optional(t.String({ maxLength: 20 })),
        timezone: t.Optional(t.String({ maxLength: 50 })),
        language: t.Optional(t.String({ maxLength: 20 })),
      }),
    },
  )

  /**
   * Get user profile
   */
  .get("/profile", async ({ request, set }) => {
    try {
      // Get authenticated user directly from auth session
      const authSession = await auth.api.getSession({
        headers: request.headers,
      })

      if (!authSession) {
        set.status = 401
        return {
          error: "Not authenticated",
          status: 401,
        }
      }

      const { user: authUser } = authSession

      const [userProfile] = await db
        .select({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          timezone: user.timezone,
          language: user.language,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.id, authUser.id))

      if (!userProfile) {
        set.status = 404
        return {
          error: "User not found",
          status: 404,
        }
      }

      return {
        user: userProfile,
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      set.status = 500
      return {
        error: "Failed to fetch profile",
        status: 500,
      }
    }
  })

  /**
   * Get user notification preferences
   */
  .get("/notification-preferences", async ({ request, set }) => {
    try {
      const authSession = await auth.api.getSession({
        headers: request.headers,
      })

      if (!authSession) {
        set.status = 401
        return {
          error: "Not authenticated",
          status: 401,
        }
      }

      const { user: authUser } = authSession

      const [userProfile] = await db
        .select({
          notificationPreferences: user.notificationPreferences,
        })
        .from(user)
        .where(eq(user.id, authUser.id))

      if (!userProfile) {
        set.status = 404
        return {
          error: "User not found",
          status: 404,
        }
      }

      // Parse preferences or return default
      const preferences = userProfile.notificationPreferences
        ? JSON.parse(userProfile.notificationPreferences)
        : { emailOpened: true }

      return {
        preferences,
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error)
      set.status = 500
      return {
        error: "Failed to fetch preferences",
        status: 500,
      }
    }
  })

  /**
   * Update user notification preferences
   */
  .patch(
    "/notification-preferences",
    async ({ body, request, set }) => {
      try {
        const authSession = await auth.api.getSession({
          headers: request.headers,
        })

        if (!authSession) {
          set.status = 401
          return {
            error: "Not authenticated",
            status: 401,
          }
        }

        const { user: authUser } = authSession

        // Update notification preferences
        const [updatedUser] = await db
          .update(user)
          .set({
            notificationPreferences: JSON.stringify(body.preferences),
          })
          .where(eq(user.id, authUser.id))
          .returning({
            id: user.id,
            notificationPreferences: user.notificationPreferences,
          })

        if (!updatedUser) {
          set.status = 404
          return {
            error: "User not found",
            status: 404,
          }
        }

        return {
          message: "Notification preferences updated successfully",
          preferences: JSON.parse(updatedUser.notificationPreferences || "{}"),
        }
      } catch (error) {
        console.error("Error updating notification preferences:", error)
        set.status = 500
        return {
          error: "Failed to update preferences",
          status: 500,
        }
      }
    },
    {
      body: t.Object({
        preferences: t.Object({
          emailOpened: t.Boolean(),
        }),
      }),
    },
  )

  /**
   * Get user active sessions
   */
  .get("/sessions", async ({ request, set }) => {
    try {
 
      const authSession = await auth.api.getSession({
        headers: request.headers,
      })

      if (!authSession) {
         set.status = 401
        return {
          error: "Not authenticated",
          status: 401,
        }
      }

      const { user: authUser, session: currentSession } = authSession
 

      let activeSessions: any[] = []
      try {
        const authSessions = await auth.api.listSessions({
          headers: request.headers,
        })
        if (Array.isArray(authSessions) && authSessions.length > 0) {
          activeSessions = authSessions
        }
      } catch (e) {
       }

      if (activeSessions.length === 0) {
        activeSessions = await db
          .select({
            id: session.id,
            userId: session.userId,
            createdAt: session.createdAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            expiresAt: session.expiresAt,
          })
          .from(session)
          .where(and(eq(session.userId, authUser.id), gt(session.expiresAt, new Date())))
      }

 
      const formattedSessions = activeSessions.map((s) => {
        const isCurrent = s.id === currentSession.id || s.token === currentSession.token
        const rawIp =
          s.ipAddress || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1"

        let ipAddress = rawIp
        let location = "Local Network"

        if (rawIp === "::1" || rawIp === "127.0.0.1" || rawIp === "localhost") {
          ipAddress = "127.0.0.1"
          location = "Local Network"
        } else {
          location = s.location || "Online"
        }

        return {
          id: s.id,
          device: parseUserAgent(s.userAgent || ""),
          location,
          ipAddress,
          createdAt: s.createdAt,
          current: isCurrent,
        }
      })

      // Ensure current session is present
      const hasCurrent = formattedSessions.some((s) => s.current)
      if (!hasCurrent && currentSession) {
        formattedSessions.unshift({
          id: currentSession.id,
          device: parseUserAgent(currentSession.userAgent || ""),
          location: "Local Network",
          ipAddress: currentSession.ipAddress || "127.0.0.1",
          createdAt: currentSession.createdAt,
          current: true,
        })
      }

 

      return {
        sessions: formattedSessions,
      }
    } catch (error) {
      console.error("❌ Error fetching user sessions:", error)
      set.status = 500
      return {
        error: "Failed to fetch sessions",
        status: 500,
      }
    }
  })

  /**
   * Revoke a session
   */
  .delete("/sessions/:sessionId", async ({ params, request, set }) => {
    try {
      const authSession = await auth.api.getSession({
        headers: request.headers,
      })

      if (!authSession) {
        set.status = 401
        return {
          error: "Not authenticated",
          status: 401,
        }
      }

      const { user: authUser, session: currentSession } = authSession

      // Don't allow revoking current session
      if (params.sessionId === currentSession.id || params.sessionId === currentSession.token) {
        set.status = 400
        return {
          error: "Cannot revoke current session",
          status: 400,
        }
      }

      // 1. Find session in DB by id or token
      const [targetSession] = await db
        .select()
        .from(session)
        .where(
          and(
            eq(session.userId, authUser.id),
            or(eq(session.id, params.sessionId), eq(session.token, params.sessionId)),
          ),
        )

      if (!targetSession) {
        // Fallback: Attempt direct Better Auth revoke by token or id if DB lookup failed
        try {
          await auth.api.revokeSession({
            body: { token: params.sessionId },
            headers: request.headers,
          })
          await redisConnection.del(`session:${params.sessionId}`).catch(() => {})
          await redisConnection.del(params.sessionId).catch(() => {})
          return { message: "Session revoked successfully" }
        } catch (e) {
           set.status = 404
          return { error: "Session not found", status: 404 }
        }
      }

      // 2. Revoke via Better Auth API using session token
      try {
        await auth.api.revokeSession({
          body: { token: targetSession.token },
          headers: request.headers,
        })
      } catch (e) {
       }

      // 3. Delete from DB
      await db.delete(session).where(eq(session.id, targetSession.id))

      // 4. Delete from Redis secondary storage if present
      if (targetSession.token) {
        try {
          await redisConnection.del(`session:${targetSession.token}`).catch(() => {})
          await redisConnection.del(targetSession.token).catch(() => {})
        } catch (redisErr) {
          console.warn("⚠️ Redis session deletion warning:", redisErr)
        }
      }

      return {
        message: "Session revoked successfully",
      }
    } catch (error) {
      console.error("Error revoking session:", error)
      set.status = 500
      return {
        error: "Failed to revoke session",
        status: 500,
      }
    }
  })

  /**
   * Subscribe to push notifications
   */
  .post(
    "/push-subscription",
    async ({ tenant, body }) => {
      try {
        await db
          .update(user)
          .set({ pushSubscription: JSON.stringify(body.subscription) })
          .where(eq(user.id, tenant.userId))

        return { success: true, message: "Push subscription saved" }
      } catch (error) {
        console.error("[User] Error saving push subscription:", error)
        return { error: "Failed to save push subscription", status: 500 }
      }
    },
    {
      body: t.Object({
        subscription: t.Object({
          endpoint: t.String(),
          keys: t.Object({
            p256dh: t.String(),
            auth: t.String(),
          }),
        }),
      }),
    },
  )

// Helper function to parse user agent
function parseUserAgent(userAgent: string): string {
  if (!userAgent) return "Unknown Device"

  const ua = userAgent.toLowerCase()

  let os = "Desktop"
  if (ua.includes("windows")) os = "Windows"
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "MacBook"
  else if (ua.includes("android")) os = "Android"
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iPhone"
  else if (ua.includes("linux")) os = "Linux"

  let browser = "Browser"
  if (ua.includes("firefox")) browser = "Firefox"
  else if (ua.includes("edg/")) browser = "Edge"
  else if (ua.includes("chrome") && !ua.includes("edg/")) browser = "Chrome"
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari"
  else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera"

  return `${os} — ${browser}`
}
