import { Elysia, t } from "elysia";
import { requireRole, tenantPlugin } from "../../shared";
import { conversationService } from "./conversation.service";


const sentimentSchema = t.Union([
  t.Literal("interested"),
  t.Literal("not_interested"),
  t.Literal("question"),
  t.Literal("auto_reply"),
  t.Literal("ooo"),
]);

export const conversationController = new Elysia({ prefix: "/conversations" })
  .use(tenantPlugin)

  .get(
    "/",
    async ({ tenant, query }) => conversationService.list(tenant, query.filter),
    {
      query: t.Object({
        filter: t.Optional(
          t.Union([
            t.Literal("all"),
            t.Literal("unread"),
            t.Literal("needs_reply"),
            t.Literal("replied"),
          ]),
        ),
      }),
    },
  )

  .get("/counts", async ({ tenant }) => conversationService.getSidebarCounts(tenant))

  .get(
    "/:id",
    async ({ tenant, params, status }) => {
      const row = await conversationService.getById(tenant, params.id);
      if (!row) return status(404, "Conversation introuvable");
      return row;
    },
    { params: t.Object({ id: t.String() }) },
  )

  .get(
    "/:id/messages",
    async ({ tenant, params, status }) => {
      const rows = await conversationService.getMessages(tenant, params.id);
      if (rows === null) return status(404, "Conversation introuvable");
      return rows;
    },
    { params: t.Object({ id: t.String() }) },
  )

  .post(
    "/:id/read",
    async ({ tenant, params, status }) => {
      const row = await conversationService.markAsRead(tenant, params.id);
      if (!row) return status(404, "Conversation introuvable");
      return row;
    },
    { params: t.Object({ id: t.String() }) },
  )

  // Écriture: viewer exclu (lecture seule sur l'inbox)
  .guard({ as: "local" }, (app) =>
    app
      .use(requireRole("admin", "member"))

      .post(
        "/:id/messages",
        async ({ tenant, params, body, status }) => {
          const row = await conversationService.sendMessage(tenant, params.id, body);
          if (!row) return status(404, "Conversation introuvable");
          return row;
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            body: t.String({ minLength: 1 }),
            subject: t.Optional(t.String()),
            hasAttachment: t.Optional(t.Boolean()),
          }),
        },
      )

      .patch(
        "/:id/sentiment",
        async ({ tenant, params, body, status }) => {
          const row = await conversationService.updateSentiment(
            tenant,
            params.id,
            body.sentiment,
          );
          if (!row) return status(404, "Conversation introuvable");
          return row;
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({ sentiment: t.Union([sentimentSchema, t.Null()]) }),
        },
      ),
  );