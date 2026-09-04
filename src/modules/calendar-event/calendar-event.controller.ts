import { Elysia, t } from "elysia"
import { requireRole, tenantPlugin } from "../../shared"
import { calendarEventService } from "./calendar-event.service"

const typeSchema = t.Union([
  t.Literal("meeting"),
  t.Literal("task"),
  t.Literal("campaign_start"),
  t.Literal("campaign_end"),
  t.Literal("warmup"),
  t.Literal("pause"),
])

export const calendarEventController = new Elysia({ prefix: "/calendar-events" })
  .use(tenantPlugin)

  .get("/", async ({ tenant, query }) => calendarEventService.list(tenant, query.from, query.to), {
    query: t.Object({
      from: t.Optional(t.String()), // "YYYY-MM-DD"
      to: t.Optional(t.String()),
    }),
  })

  .get(
    "/:id",
    async ({ tenant, params, status }) => {
      const row = await calendarEventService.getById(tenant, params.id)
      if (!row) return status(404, "Event introuvable")
      return row
    },
    { params: t.Object({ id: t.String() }) },
  )

  .guard({ as: "local" }, (app) =>
    app
      .use(requireRole("admin", "member"))

      .post(
        "/",
        async ({ tenant, body }) => {
          return calendarEventService.create(tenant, { id: crypto.randomUUID(), ...body })
        },
        {
          body: t.Object({
            type: typeSchema,
            title: t.String({ minLength: 1 }),
            eventDate: t.String(),
            eventTime: t.Optional(t.String()),
            meta: t.Optional(t.String()),
            assigneeId: t.Optional(t.String()),
            mailId: t.Optional(t.String()),
            leadId: t.Optional(t.String()),
          }),
        },
      )

      .patch(
        "/:id",
        async ({ tenant, params, body, error }) => {
          const row = await calendarEventService.update(tenant, params.id, body)
          if (row === null) return error(404, "Event introuvable")
          if (row === "forbidden") return error(403, "Seul le créateur, l'assigné ou un admin peut modifier cet event")
          return row
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            type: t.Optional(typeSchema),
            title: t.Optional(t.String({ minLength: 1 })),
            eventDate: t.Optional(t.String()),
            eventTime: t.Optional(t.String()),
            meta: t.Optional(t.String()),
            assigneeId: t.Optional(t.String()),
          }),
        },
      )

      .delete(
        "/:id",
        async ({ tenant, params, error }) => {
          const row = await calendarEventService.remove(tenant, params.id)
          if (row === null) return error(404, "Event introuvable")
          if (row === "forbidden") return error(403, "Seul le créateur, l'assigné ou un admin peut supprimer cet event")
          return { success: true }
        },
        { params: t.Object({ id: t.String() }) },
      ),
  )
