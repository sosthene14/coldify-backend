import { minioClient, BUCKET_NAME } from "../../shared/lib/minio";
import type { TenantContext } from "../../shared/plugins/tenant";
import { eq, and } from "drizzle-orm";
import { db } from "../../shared";
import { member } from "../../shared/db/schema";

async function getMemberId(tenant: TenantContext) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, tenant.userId),
        eq(member.organizationId, tenant.organizationId),
      ),
    )
    .limit(1);

  return row?.id ?? null;
}

export const uploadService = {
  /**
   * Génère une URL signée pour uploader une image
   * L'image sera stockée avec le chemin : {organizationId}/{memberId}/{uuid}-{filename}
   */
  async generateUploadUrl(
    tenant: TenantContext,
    fileName: string,
    contentType: string,
  ) {
    const memberId = await getMemberId(tenant);
    if (!memberId) throw new Error("Member not found");

    // Valider le type de fichier
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(contentType)) {
      throw new Error("Invalid file type. Only images are allowed.");
    }

    // Valider la taille du nom de fichier
    if (fileName.length > 255) {
      throw new Error("File name too long");
    }

    // Nettoyer le nom de fichier
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Générer un chemin unique : orgId/memberId/uuid-filename
    const fileId = crypto.randomUUID();
    const objectKey = `${tenant.organizationId}/${memberId}/${fileId}-${cleanFileName}`;

    // Générer une URL signée pour l'upload (valide 5 minutes)
    const uploadUrl = await minioClient.presignedPutObject(
      BUCKET_NAME,
      objectKey,
      5 * 60, // 5 minutes
      {
        "Content-Type": contentType,
      },
    );

    // L'URL publique ne fonctionnera pas sans signature
    // On retourne juste la clé pour générer des URLs signées plus tard
    return {
      uploadUrl,
      objectKey,
      fileId,
    };
  },

  /**
   * Génère une URL signée pour télécharger/afficher une image
   * Vérifie que l'utilisateur est le propriétaire de l'image
   */
  async generateViewUrl(
    tenant: TenantContext,
    objectKey: string,
    expiresIn: number = 3600, // 1 heure par défaut
  ) {
    const memberId = await getMemberId(tenant);
    if (!memberId) throw new Error("Member not found");

    // Vérifier que l'image appartient à l'utilisateur ou à son organisation
    const keyParts = objectKey.split("/");
    const [orgId, ownerId] = keyParts;

    // Seul le propriétaire ou un admin de l'org peut voir l'image
    const canView =
      tenant.isSuperAdmin ||
      (orgId === tenant.organizationId && ownerId === memberId) ||
      (orgId === tenant.organizationId && tenant.role === "admin");

    if (!canView) {
      throw new Error("Unauthorized: You don't have access to this image");
    }

    // Générer une URL signée pour la visualisation
    const viewUrl = await minioClient.presignedGetObject(
      BUCKET_NAME,
      objectKey,
      expiresIn,
    );

    return { viewUrl };
  },

  /**
   * Supprime une image
   * Seul le propriétaire peut supprimer
   */
  async deleteImage(tenant: TenantContext, objectKey: string) {
    const memberId = await getMemberId(tenant);
    if (!memberId) throw new Error("Member not found");

    // Vérifier que l'image appartient à l'utilisateur
    const keyParts = objectKey.split("/");
    const [orgId, ownerId] = keyParts;

    const canDelete =
      tenant.isSuperAdmin ||
      (orgId === tenant.organizationId && ownerId === memberId) ||
      (orgId === tenant.organizationId && tenant.role === "admin");

    if (!canDelete) {
      throw new Error("Unauthorized: You don't have permission to delete this image");
    }

    await minioClient.removeObject(BUCKET_NAME, objectKey);

    return { success: true };
  },

  /**
   * Remplace les objectKeys dans le HTML par des URLs signées
   * Usage: avant d'envoyer un email, on transforme les clés en URLs signées
   */
  async transformImageKeys(
    tenant: TenantContext,
    htmlContent: string,
    expiresIn: number = 7 * 24 * 3600, // 7 jours pour les emails
  ): Promise<string> {
    const memberId = await getMemberId(tenant);
    if (!memberId) return htmlContent;

    // Regex pour trouver les src="minio://{objectKey}"
    const regex = /src="minio:\/\/([^"]+)"/g;
    const matches = [...htmlContent.matchAll(regex)];

    let transformedHtml = htmlContent;

    for (const match of matches) {
      const objectKey = match[1];
      try {
        const { viewUrl } = await this.generateViewUrl(tenant, objectKey, expiresIn);
        transformedHtml = transformedHtml.replace(
          `minio://${objectKey}`,
          viewUrl,
        );
      } catch (error) {
        console.error(`Failed to transform image key: ${objectKey}`, error);
      }
    }

    return transformedHtml;
  },
};
