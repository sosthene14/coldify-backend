import { Elysia, t } from "elysia"
import { tenantPlugin } from "../../shared"
import { notificationService } from "./notifications.service"

export const notificationController = new Elysia({ prefix: "/notifications" })
  .use(tenantPlugin)

  .get("/", async ({ tenant, query }) => notificationService.list(tenant, query.unreadOnly === "true"), {
    query: t.Object({ unreadOnly: t.Optional(t.String()) }),
  })

  .get("/unread-count", async ({ tenant }) => ({
    count: await notificationService.getUnreadCount(tenant),
  }))

  .post(
    "/:id/read",
    async ({ tenant, params, status }) => {
      const row = await notificationService.markAsRead(tenant, params.id)
      if (!row) return status(404, "Notification introuvable")
      return row
    },
    { params: t.Object({ id: t.String() }) },
  )

  .post("/read-all", async ({ tenant }) => notificationService.markAllAsRead(tenant))
