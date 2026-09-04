import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { auth } from "./shared/lib/auth"
import { initMinIO } from "./shared/lib/minio"
import "./shared/workers/email.worker"
import "./shared/workers/attachment-cleanup.worker"
import "./shared/workers/attachment-cleanup-scheduler"
import "./shared/workers/scheduled-email.worker"

// WebSocket message types
type WebSocketMessage =
  | {
      type: "join:user"
      userId: string
    }
  | {
      type: string
      [key: string]: unknown
    }

 import { conversationController } from "./modules/conversation"
import { emailHistoryController } from "./modules/email-history"
// Import des contrôleurs des modules
 
import { mailboxController } from "./modules/mailbox"
 import { organizationQuotaController } from "./modules/organization-quota/organization-quota.controller"
import { reportingController } from "./modules/reporting"
import { emailTrackingController } from "./modules/reporting/email-tracking.controller"
import { scheduledEmailController } from "./modules/scheduled-email/scheduled-email.controller"
import { subscriptionController } from "./modules/subscriptions/subscription.controller"
import { templateController } from "./modules/template"
import { uploadController } from "./modules/upload"
import { userController } from "./modules/user/user.controller"
import { initWebSocket, joinUser, leaveUser } from "./shared/lib/websocket"

// Initialiser MinIO au démarrage
initMinIO()
  .then(() => {
    console.log("✓ MinIO initialized")
  })
  .catch((err) => {
    console.error("✗ MinIO initialization failed:", err)
  })

const app = new Elysia()
  .use(
    cors({
      origin: ["https://so-mails.com"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .onBeforeHandle(({ set }) => {
    // Ensure UTF-8 encoding for all responses
    set.headers["Content-Type"] = "application/json; charset=utf-8"
  })
  .get("/", () => "Hello Elysia")
  .group("/api", (app) =>
    app
      .mount(auth.handler)
      .use(templateController)
      .use(conversationController)
      .use(reportingController)
      .use(uploadController)
      .use(mailboxController)
      .use(emailHistoryController)
      .use(scheduledEmailController)
      .use(userController)
      .use(organizationQuotaController)
      .use(subscriptionController),
  )
  .use(emailTrackingController) // Public tracking endpoint (keep outside /api for backwards compatibility)
  .ws("/ws", {
    open(ws) {
      console.log("[WebSocket] ✅ User connected")
      ws.send(JSON.stringify({ type: "connected" }))
    },
    //@ts-nocheck type mismatch
    message(ws, message) {
      try {
        // Handle message as object (Bun auto-parses) or string
        let data: WebSocketMessage
        if (typeof message === "string") {
          data = JSON.parse(message)
        } else if (Buffer.isBuffer(message)) {
          data = JSON.parse(message.toString())
        } else {
          data = message as WebSocketMessage
        }

        if (data.type === "join:user" && data.userId) {
          //@ts-expect-error type mismatch
          joinUser(ws, data.userId)
          console.log(`[WebSocket] 🔗 User joined: ${data.userId}`)
          ws.send(
            JSON.stringify({
              type: "joined",
              userId: data.userId,
            }),
          )
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error)
      }
    },
    close(ws) {
      console.log("[WebSocket] ❌ User disconnected")
      //@ts-expect-error type mismatch
      leaveUser(ws)
    },
  })
  .listen({
    hostname: "0.0.0.0",
    port: 3001,
  })

// Initialize WebSocket tracking
//@ts-expect-error type mismatch
initWebSocket(app)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)

// Export for WebSocket access
export { app }