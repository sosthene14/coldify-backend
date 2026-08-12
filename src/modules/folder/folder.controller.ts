import { Elysia, t } from "elysia";
import { tenantPlugin, requireRole } from "../../shared/plugins/tenant";
import { folderService } from "./folder.service";

export const folderController = new Elysia({ prefix: "/folders" })
  .use(tenantPlugin)

  .get("/", async ({ tenant }) => {
    return folderService.list(tenant);
  })

  .get(
    "/:id",
    async ({ tenant, params, status }) => {
      const row = await folderService.getById(tenant, params.id);
      if (!row) return status(404, "Folder introuvable");
      return row;
    },
    { params: t.Object({ id: t.String() }) },
  )

  .guard({ as: "local" }, (app) =>
    app
      .use(requireRole("admin", "member"))

      .post(
        "/",
        async ({ tenant, body }) => {
          return folderService.create(tenant, {
            id: crypto.randomUUID(),
            name: body.name,
            description: body.description,
          });
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1 }),
            description: t.Optional(t.String()),
          }),
        },
      )

      .patch(
        "/:id",
        async ({ tenant, params, body, error }) => {
          const row = await folderService.update(tenant, params.id, body);
          if (!row) return error(404, "Folder introuvable ou accès refusé");
          return row;
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            description: t.Optional(t.String()),
          }),
        },
      )

      .delete(
        "/:id",
        async ({ tenant, params, error }) => {
          const row = await folderService.remove(tenant, params.id);
          if (!row) return error(404, "Folder introuvable ou accès refusé");
          return { success: true };
        },
        { params: t.Object({ id: t.String() }) },
      ),
  );
