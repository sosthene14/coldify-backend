import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./shared/lib/auth";
import { initMinIO } from "./shared/lib/minio";
import "./shared/workers/email.worker";
import "./shared/workers/attachment-cleanup.worker";
import "./shared/workers/attachment-cleanup-scheduler";
import "./shared/workers/scheduled-email.worker";

// Import des contrôleurs des modules
import { folderController } from "./modules/folder";
import { campaignController } from "./modules/campaign";
import { usageController } from "./modules/usage";
import { leadController } from "./modules/lead";
import { templateController } from "./modules/template";
import { reportingController } from "./modules/reporting";
import { conversationController } from "./modules/conversation";
import { calendarEventController } from "./modules/calendar-event";
import { organizationCustomFieldController } from "./modules/organization-custom-field";
import { uploadController } from "./modules/upload";
import { mailboxController } from "./modules/mailbox";
import { emailHistoryController } from "./modules/email-history";
import { scheduledEmailController } from "./modules/scheduled-email/scheduled-email.controller";
import { emailTrackingController } from "./modules/reporting/email-tracking.controller";
import { userController } from "./modules/user/user.controller";
import { organizationQuotaController } from "./modules/organization-quota/organization-quota.controller";
import { initWebSocket, joinOrganization, leaveOrganization } from "./shared/lib/websocket";

// Initialiser MinIO au démarrage
initMinIO().then(() => {
  console.log("✓ MinIO initialized");
}).catch((err) => {
  console.error("✗ MinIO initialization failed:", err);
});

const app = new Elysia()
  .use(
    cors({
      origin: ["http://localhost:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .onBeforeHandle(({ set }) => {
    // Ensure UTF-8 encoding for all responses
    set.headers['Content-Type'] = 'application/json; charset=utf-8'
  })
  .mount(auth.handler)
  .get("/", () => "Hello Elysia")
  .use(folderController)
  .use(campaignController)
  .use(usageController)
  .use(leadController)
  .use(templateController)
  .use(organizationCustomFieldController)
  .use(conversationController)
  .use(calendarEventController)
  .use(reportingController)
  .use(uploadController)
  .use(mailboxController)
  .use(emailHistoryController)
  .use(scheduledEmailController)
  .use(userController)
  .use(organizationQuotaController)
  .use(emailTrackingController) // Public tracking endpoint
  .ws("/ws", {
    open(ws) {
      console.log("[WebSocket] Client connected");
      ws.send(JSON.stringify({ type: "connected" }));
    },
    message(ws, message) {
      try {
        // Handle message as object (Bun auto-parses) or string
        let data: any;
        if (typeof message === 'string') {
          data = JSON.parse(message);
        } else if (Buffer.isBuffer(message)) {
          data = JSON.parse(message.toString());
        } else {
          data = message;
        }
        
        if (data.type === "join:organization" && data.organizationId) {
          joinOrganization(ws, data.organizationId);
          ws.send(JSON.stringify({ 
            type: "joined", 
            organizationId: data.organizationId 
          }));
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    },
    close(ws) {
      console.log("[WebSocket] Client disconnected");
      leaveOrganization(ws);
    },
  })
  .listen(3001);

// Initialize WebSocket tracking
initWebSocket(app);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

// Export for WebSocket access
export { app };
