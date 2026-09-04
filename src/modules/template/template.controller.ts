import { Elysia, t } from "elysia"
import { requireRole, tenantPlugin } from "../../shared/plugins/tenant"
import { templateService } from "./template.service"

export const templateController = new Elysia({ prefix: "/templates" })
  .use(tenantPlugin)

  .get("/", async ({ tenant }) => templateService.list(tenant))

  .get(
    "/:id",
    async ({ tenant, params, status }) => {
      const row = await templateService.getById(tenant, params.id)
      if (!row) return status(404, "Template introuvable")
      return row
    },
    { params: t.Object({ id: t.String() }) },
  )

  // Get template statistics with time series data
  .get(
    "/:id/stats",
    async ({ tenant, params, status }) => {
      const stats = await templateService.getTemplateStats(tenant, params.id)
      if (!stats) return status(404, "Template introuvable")
      return stats
    },
    { params: t.Object({ id: t.String() }) },
  )

  // "Utiliser" un template (ex: au moment de créer une campagne) -> stats
  // accessible à tout rôle qui a le droit de LIRE le template (member/viewer inclus)
  .post(
    "/:id/use",
    async ({ tenant, params, status }) => {
      const row = await templateService.recordUsage(tenant, params.id)
      if (!row) return status(404, "Template introuvable")
      return row
    },
    { params: t.Object({ id: t.String() }) },
  )

  .post(
    "/:id/star",
    async ({ tenant, params, status }) => {
      const row = await templateService.star(tenant, params.id)
      if (!row) return status(404, "Template introuvable")
      return row
    },
    { params: t.Object({ id: t.String() }) },
  )

  .delete("/:id/star", async ({ tenant, params }) => templateService.unstar(tenant, params.id), {
    params: t.Object({ id: t.String() }),
  })

  // Écriture (création/édition/suppression/fork): viewer exclu
  .guard({ as: "local" }, (app) =>
    app
      .use(requireRole("admin", "member"))

      .post(
        "/",
        async ({ tenant, body }) => {
          return templateService.create(tenant, { id: crypto.randomUUID(), ...body })
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1 }),
            subject: t.String({ minLength: 1 }),
            body: t.String(),
            category: t.Optional(t.String()),
            language: t.Optional(t.String()),
            preview: t.Optional(t.String()),
            isPrivate: t.Optional(t.Boolean()),
          }),
        },
      )

      .patch(
        "/:id",
        async ({ tenant, params, body, error }) => {
          const row = await templateService.update(tenant, params.id, body)
          if (row === null) return error(404, "Template introuvable")
          if (row === "forbidden") return error(403, "Seul le créateur ou un admin peut modifier ce template")
          return row
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            subject: t.Optional(t.String({ minLength: 1 })),
            body: t.Optional(t.String()),
            category: t.Optional(t.String()),
            language: t.Optional(t.String()),
            preview: t.Optional(t.String()),
            isPrivate: t.Optional(t.Boolean()),
          }),
        },
      )

      .delete(
        "/:id",
        async ({ tenant, params, error }) => {
          const row = await templateService.remove(tenant, params.id)
          if (row === null) return error(404, "Template introuvable")
          if (row === "forbidden") return error(403, "Seul le créateur ou un admin peut supprimer ce template")
          return { success: true }
        },
        { params: t.Object({ id: t.String() }) },
      )

      .post(
        "/:id/duplicate",
        async ({ tenant, params, error }) => {
          const row = await templateService.duplicate(tenant, params.id)
          if (!row) return error(404, "Template introuvable")
          return row
        },
        { params: t.Object({ id: t.String() }) },
      )

      // Admin only: recalculate statistics for all templates
      .post("/recalculate-stats", async ({ tenant, error }) => {
        if (tenant.role !== "admin" && !tenant.isSuperAdmin) {
          return error(403, "Admin access required")
        }

        await templateService.recalculateAllStats(tenant.organizationId)
        return { success: true, message: "Statistics recalculated for all templates" }
      }),
  )
