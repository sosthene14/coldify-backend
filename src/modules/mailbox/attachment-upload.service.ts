import { minioClient, BUCKET_NAME } from "../../shared/lib/minio";
import { nanoid } from "nanoid";

const ATTACHMENTS_PREFIX = "attachments/"; // Separate from template images
const ATTACHMENT_EXPIRY_HOURS = 24; // Delete after 24 hours

interface UploadAttachmentParams {
  organizationId: string;
  memberId: string;
  file: Buffer;
  filename: string;
  mimeType: string;
}

export const attachmentUploadService = {
  /**
   * Upload attachment to MinIO with expiration
   */
  async uploadAttachment(
    params: UploadAttachmentParams
  ): Promise<{ objectKey: string; url: string }> {
    const bucket = BUCKET_NAME;

    // Generate object key: attachments/{orgId}/{memberId}/{uuid}-{filename}
    const uuid = nanoid();
    const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `${ATTACHMENTS_PREFIX}${params.organizationId}/${params.memberId}/${uuid}-${sanitizedFilename}`;

    // Upload to MinIO
    await minioClient.putObject(bucket, objectKey, params.file, params.file.length, {
      "Content-Type": params.mimeType,
      // Add metadata for cleanup
      "X-Amz-Meta-Upload-Time": new Date().toISOString(),
      "X-Amz-Meta-Organization-Id": params.organizationId,
      "X-Amz-Meta-Member-Id": params.memberId,
      "X-Amz-Meta-Expires-At": new Date(
        Date.now() + ATTACHMENT_EXPIRY_HOURS * 60 * 60 * 1000
      ).toISOString(),
    });

    // Generate temporary signed URL (valid for 1 hour for verification)
    const url = await minioClient.presignedGetObject(bucket, objectKey, 3600);

    return { objectKey, url };
  },

  /**
   * Delete attachment after email is sent
   */
  async deleteAttachment(objectKey: string): Promise<void> {
    const bucket = BUCKET_NAME;

    try {
      await minioClient.removeObject(bucket, objectKey);
    } catch (error) {
      console.error(`Failed to delete attachment ${objectKey}:`, error);
      // Don't throw - attachment will be cleaned up by scheduled job
    }
  },

  /**
   * Clean up expired attachments
   * Should be run periodically (e.g., every hour)
   */
  async cleanupExpiredAttachments(): Promise<{
    deleted: number;
    errors: number;
  }> {
    const bucket = BUCKET_NAME;

    let deleted = 0;
    let errors = 0;

    try {
      const stream = minioClient.listObjects(bucket, ATTACHMENTS_PREFIX, true);

      for await (const obj of stream) {
        if (!obj.name) continue;

        try {
          // Get object metadata
          const stat = await minioClient.statObject(bucket, obj.name);
          const expiresAt = stat.metaData?.["expires-at"];

          if (expiresAt && new Date(expiresAt) <= new Date()) {
            // Attachment has expired, delete it
            await minioClient.removeObject(bucket, obj.name);
            deleted++;
            console.log(`Deleted expired attachment: ${obj.name}`);
          }
        } catch (error) {
          console.error(`Error processing attachment ${obj.name}:`, error);
          errors++;
        }
      }

      return { deleted, errors };
    } catch (error) {
      console.error("Failed to cleanup expired attachments:", error);
      throw error;
    }
  },

  /**
   * Get attachment metadata
   */
  async getAttachmentInfo(
    objectKey: string
  ): Promise<{ size: number; mimeType: string; expiresAt: Date } | null> {
    const bucket = BUCKET_NAME;

    try {
      const stat = await minioClient.statObject(bucket, objectKey);

      return {
        size: stat.size,
        mimeType: stat.metaData?.["content-type"] || "application/octet-stream",
        expiresAt: new Date(stat.metaData?.["expires-at"] || Date.now()),
      };
    } catch (error) {
      console.error(`Failed to get attachment info for ${objectKey}:`, error);
      return null;
    }
  },
};
