import { Elysia, t } from "elysia";
import { requireRole, tenantPlugin } from "../../shared";
import { organizationCustomFieldService } from "./organization-custom-field.service";


const fieldTypeSchema = t.Union([t.Literal("text"), t.Literal("date"), t.Literal("select")]);

export const organizationCustomFieldController = new Elysia({ prefix: "/custom-fields" })
  .use(tenantPlugin)

  .get("/", async ({ tenant }) => organizationCustomFieldService.list(tenant))

  .get(
    "/:id",
    async ({ tenant, params, status }) => {
      const row = await organizationCustomFieldService.getById(tenant, params.id);
      if (!row) return status(404, "Champ introuvable");
      return row;
    },
    { params: t.Object({ id: t.String() }) },
  )

  // Écriture: réservée aux admin, viewer ET member exclus (config d'org)
  .guard({ as: "local" }, (app) =>
    app
      .use(requireRole("admin"))

      .post(
        "/",
        async ({ tenant, body, error }) => {
          const row = await organizationCustomFieldService.create(tenant, {
            id: crypto.randomUUID(),
            ...body,
          });
          if (row === "forbidden") return error(403, "Réservé aux admin");
          return row;
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1 }),
            fieldType: fieldTypeSchema,
            options: t.Optional(t.Array(t.String())),
            isRequired: t.Optional(t.Boolean()),
            position: t.Optional(t.Number()),
          }),
        },
      )

      .patch(
        "/:id",
        async ({ tenant, params, body, error }) => {
          const row = await organizationCustomFieldService.update(tenant, params.id, body);
          if (row === "forbidden") return error(403, "Réservé aux admin");
          if (row === null) return error(404, "Champ introuvable");
          return row;
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            fieldType: t.Optional(fieldTypeSchema),
            options: t.Optional(t.Array(t.String())),
            isRequired: t.Optional(t.Boolean()),
            position: t.Optional(t.Number()),
          }),
        },
      )

      .delete(
        "/:id",
        async ({ tenant, params, error }) => {
          const row = await organizationCustomFieldService.remove(tenant, params.id);
          if (row === "forbidden") return error(403, "Réservé aux admin");
          if (row === null) return error(404, "Champ introuvable");
          return { success: true };
        },
        { params: t.Object({ id: t.String() }) },
      ),
  );