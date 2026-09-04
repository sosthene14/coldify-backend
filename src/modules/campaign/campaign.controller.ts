import { Elysia, t } from "elysia"
import { requireRole, tenantPlugin } from "../../shared/plugins/tenant"
import { campaignService } from "./campaign.service"

const statusSchema = t.Union([t.Literal("active"), t.Literal("draft"), t.Literal("completed"), t.Literal("archived")])

export const campaignController = new Elysia({ prefix: "/campaigns" })
  .use(tenantPlugin)

  // Lecture: tous rôles, scoping fait dans le service
  .get("/", async ({ tenant }) => {
    return campaignService.list(tenant)
  })

  .get(
    "/:id",
    async ({ tenant, params, status }) => {
      const row = await campaignService.getById(tenant, params.id)
      if (!row) return status(404, "Campagne introuvable")
      return row
    },
    { params: t.Object({ id: t.String() }) },
  )

  // Écriture: viewer exclu
  .guard({ as: "local" }, (app) =>
    app
      .use(requireRole("admin", "member"))

      .post(
        "/",
        async ({ tenant, body, error }) => {
          try {
            return await campaignService.create(tenant, {
              id: crypto.randomUUID(),
              name: body.name,
              status: body.status,
            })
          } catch (_e) {
            return error(403, "Impossible de créer la campagne")
          }
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1 }),
            status: t.Optional(statusSchema),
          }),
        },
      )

      .patch(
        "/:id",
        async ({ tenant, params, body, error }) => {
          const row = await campaignService.update(tenant, params.id, body)
          if (!row) return error(404, "Campagne introuvable ou accès refusé")
          return row
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            status: t.Optional(statusSchema),
          }),
        },
      )

      .delete(
        "/:id",
        async ({ tenant, params, error }) => {
          const row = await campaignService.remove(tenant, params.id)
          if (!row) return error(404, "Campagne introuvable ou accès refusé")
          return { success: true }
        },
        { params: t.Object({ id: t.String() }) },
      ),
  )
