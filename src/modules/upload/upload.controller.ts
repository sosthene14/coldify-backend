import { Elysia, t } from "elysia";
import { tenantPlugin } from "../../shared/plugins/tenant";
import { uploadService } from "./upload.service";

export const uploadController = new Elysia({ prefix: "/uploads" })
  .use(tenantPlugin)

  // Générer une URL d'upload pour une image
  .post(
    "/template-image",
    async ({ tenant, body }) => {
      const { fileName, contentType } = body;
      return uploadService.generateUploadUrl(tenant, fileName, contentType);
    },
    {
      body: t.Object({
        fileName: t.String({ maxLength: 255 }),
        contentType: t.String(),
      }),
    },
  )

  // Générer une URL de visualisation pour une image
  .post(
    "/view-image",
    //@ts-ignore type mismatch
    async ({ tenant, body, error }) => {
      const { objectKey, expiresIn } = body;
      try {
        return await uploadService.generateViewUrl(
          tenant,
          objectKey,
          expiresIn,
        );
      } catch (err) {
        if (err instanceof Error && err.message.includes("Unauthorized")) {
          return error(403, err.message);
        }
        throw err;
      }
    },
    {
      body: t.Object({
        objectKey: t.String(),
        expiresIn: t.Optional(t.Number({ minimum: 60, maximum: 604800 })), // 1 min à 7 jours
      }),
    },
  )

  // Supprimer une image
  .delete(
    "/image/:objectKey",
    //@ts-ignore type mismatch
    async ({ tenant, params, error }) => {
      try {
        // Décoder l'objectKey depuis l'URL
        const objectKey = decodeURIComponent(params.objectKey);
        return await uploadService.deleteImage(tenant, objectKey);
      } catch (err) {
        if (err instanceof Error && err.message.includes("Unauthorized")) {
          return error(403, err.message);
        }
        throw err;
      }
    },
    {
      params: t.Object({
        objectKey: t.String(),
      }),
    },
  )

  // Transformer les clés MinIO en URLs signées dans du HTML
  .post(
    "/transform-html",
    async ({ tenant, body }) => {
      const { htmlContent, expiresIn } = body;
      return {
        htmlContent: await uploadService.transformImageKeys(
          tenant,
          htmlContent,
          expiresIn,
        ),
      };
    },
    {
      body: t.Object({
        htmlContent: t.String(),
        expiresIn: t.Optional(t.Number({ minimum: 60, maximum: 604800 })),
      }),
    },
  );
