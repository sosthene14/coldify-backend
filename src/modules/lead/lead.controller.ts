import { Elysia, t } from "elysia";
import { requireRole, tenantPlugin } from "../../shared";
import { leadService } from "./lead.service";


const statusSchema = t.Union([
  t.Literal("new"),
  t.Literal("contacted"),
  t.Literal("opened"),
  t.Literal("clicked"),
  t.Literal("replied"),
  t.Literal("interested"),
  t.Literal("not_interested"),
  t.Literal("bounced"),
  t.Literal("unsubscribed"),
  t.Literal("do_not_contact"),
]);

const sourceSchema = t.Union([
  t.Literal("manual"),
  t.Literal("csv_import"),
  t.Literal("apollo"),
  t.Literal("linkedin_scraper"),
  t.Literal("api"),
  t.Literal("form"),
  t.Literal("other"),
]);

export const leadController = new Elysia({ prefix: "/leads" })
  .use(tenantPlugin)

  .get(
    "/",
    async ({ tenant, query }) => {
      if (query.customFieldId && query.customFieldValue) {
        return leadService.listByCustomField(
          tenant,
          query.customFieldId,
          query.customFieldValue,
        );
      }
      return leadService.list(tenant);
    },
    {
      query: t.Object({
        customFieldId: t.Optional(t.String()),
        customFieldValue: t.Optional(t.String()),
      }),
    },
  )

  .get(
    "/:id",
    async ({ tenant, params, status }) => {
      const row = await leadService.getById(tenant, params.id);
      if (!row) return status(404, "Lead introuvable");
      return row;
    },
    { params: t.Object({ id: t.String() }) },
  )

  .get(
    "/:id/campaigns",
    async ({ tenant, params, status }) => {
      const rows = await leadService.listCampaignStatuses(tenant, params.id);
      if (rows === null) return status(404, "Lead introuvable");
      return rows;
    },
    { params: t.Object({ id: t.String() }) },
  )

  // Écriture: viewer exclu
  .guard({ as: "local" }, (app) =>
    app
      .use(requireRole("admin", "member"))

      .post(
        "/",
        async ({ tenant, body }) => {
          return leadService.create(tenant, {
            id: crypto.randomUUID(),
            ...body,
          });
        },
        {
          body: t.Object({
            firstName: t.String({ minLength: 1 }),
            lastName: t.String({ minLength: 1 }),
            email: t.String({ format: "email" }),
            jobTitle: t.Optional(t.String()),
            companyName: t.Optional(t.String()),
            source: t.Optional(sourceSchema),
            ownerId: t.Optional(t.String()), // ignoré si pas admin (cf. service)
            customFields: t.Optional(
              t.Array(t.Object({ fieldId: t.String(), value: t.String() })),
            ),
          }),
        },
      )

      .patch(
        "/:id",
        async ({ tenant, params, body, error }) => {
          const row = await leadService.update(tenant, params.id, body);
          if (!row) return error(404, "Lead introuvable ou accès refusé");
          return row;
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            firstName: t.Optional(t.String({ minLength: 1 })),
            lastName: t.Optional(t.String({ minLength: 1 })),
            email: t.Optional(t.String({ format: "email" })),
            jobTitle: t.Optional(t.String()),
            companyName: t.Optional(t.String()),
            status: t.Optional(statusSchema),
            leadScore: t.Optional(t.Number()),
            tags: t.Optional(t.Array(t.String())),
            notes: t.Optional(t.String()),
            ownerId: t.Optional(t.String()),
            customFields: t.Optional(
              t.Array(t.Object({ fieldId: t.String(), value: t.String() })),
            ),
          }),
        },
      )

      .delete(
        "/:id",
        async ({ tenant, params, error }) => {
          const row = await leadService.remove(tenant, params.id);
          if (!row) return error(404, "Lead introuvable ou accès refusé");
          return { success: true };
        },
        { params: t.Object({ id: t.String() }) },
      )

      .put(
        "/:id/campaigns/:mailId",
        async ({ tenant, params, body, error }) => {
          const row = await leadService.upsertCampaignStatus(
            tenant,
            params.id,
            params.mailId,
            body,
          );
          if (!row) return error(404, "Lead introuvable ou accès refusé");
          return row;
        },
        {
          params: t.Object({ id: t.String(), mailId: t.String() }),
          body: t.Object({
            status: t.Optional(statusSchema),
            sequenceStep: t.Optional(t.Number()),
          }),
        },
      ),
  );