import { Elysia, t } from "elysia";
import { scheduledEmailService } from "./scheduled-email.service";
import { addScheduledEmail, cancelScheduledEmail } from "../../shared/queues/scheduled-email.queue";
import { tenantPlugin } from "../../shared/plugins/tenant";
import { attachmentUploadService } from "../mailbox/attachment-upload.service";

// Ajuste les champs ci-dessous pour qu'ils correspondent exactement
// à la forme réelle d'un attachment dans ton domaine.
const attachmentSchema = t.Object({
  objectKey: t.String(),
  filename: t.Optional(t.String()),
  contentType: t.Optional(t.String()),
  size: t.Optional(t.Number()),
});

const idParams = t.Object({
  id: t.String(),
});

const updateScheduledEmailBody = t.Object({
  to: t.Array(t.String()),
  cc: t.Optional(t.Array(t.String())),
  bcc: t.Optional(t.Array(t.String())),
  subject: t.String(),
  html: t.String(),
  text: t.Optional(t.String()),
  scheduledAt: t.String(), // ISO string, converti en Date ensuite
  attachments: t.Optional(t.Array(attachmentSchema)),
});

export const scheduledEmailController = new Elysia({ prefix: "/scheduled-emails" })
  .use(tenantPlugin)

  // Get statistics (déclarée avant "/:id" pour éviter toute ambiguïté de routing)
  .get("/stats", async ({ tenant }) => {
    const stats = await scheduledEmailService.getStats(tenant.organizationId);
    return stats;
  })

  // Get all scheduled emails for organization
  .get("/", async ({ tenant }) => {
    const emails = await scheduledEmailService.getByOrganization(
      tenant.organizationId
    );
    return emails;
  })

  // Get scheduled email by ID
  .get(
    "/:id",
    async ({ params, tenant }) => {
      const email = await scheduledEmailService.getById(
        params.id,
        tenant.organizationId
      );

      if (!email) {
        return {
          success: false,
          error: "Scheduled email not found",
        };
      }

      return email;
    },
    {
      params: idParams,
    }
  )

  // Update scheduled email
  .patch(
    "/:id",
    async ({ params, body, tenant }) => {
      const email = await scheduledEmailService.getById(
        params.id,
        tenant.organizationId
      );

      if (!email) {
        return {
          success: false,
          error: "Scheduled email not found",
        };
      }

      if (email.status !== "pending") {
        return {
          success: false,
          error: `Cannot edit email with status: ${email.status}`,
        };
      }

      // Cancel old job in queue if it exists
      if (email.jobId) {
        await cancelScheduledEmail(email.jobId);
      }

      // Update scheduled email
      const updated = await scheduledEmailService.update(
        params.id,
        tenant.organizationId,
        {
          to: body.to,
          cc: body.cc,
          bcc: body.bcc,
          subject: body.subject,
          htmlContent: body.html,
          textContent: body.text,
          scheduledAt: new Date(body.scheduledAt),
          //@ts-ignore type mismatch
          attachments: body.attachments,
          hasAttachments: (body.attachments?.length ?? 0) > 0,
          attachmentCount: body.attachments?.length ?? 0,
        }
      );

      if (!updated) {
        return {
          success: false,
          error: "Failed to update scheduled email",
        };
      }

      const jobId = await addScheduledEmail(
        {
          scheduledEmailId: updated.id,
          organizationId: tenant.organizationId,
          mailboxId: updated.mailboxId,
          to: updated.to as string[],
          cc: updated.cc as string[] | undefined,
          bcc: updated.bcc as string[] | undefined,
          subject: updated.subject,
          //@ts-ignore type mismatch
          html: updated.htmlContent,
          text: updated.textContent || undefined,
          attachments: updated.attachments as any,
        },
        updated.scheduledAt
      );

      await scheduledEmailService.updateJobId(updated.id, jobId);

      return {
        success: true,
        message: "Scheduled email updated successfully",
        email: updated,
      };
    },
    {
      params: idParams,
      body: updateScheduledEmailBody,
    }
  )

  // Delete scheduled email (cancel if pending, delete if already cancelled/failed/sent)
  .delete(
    "/:id",
    async ({ params, tenant }) => {
      const email = await scheduledEmailService.getById(
        params.id,
        tenant.organizationId
      );

      if (!email) {
        return {
          success: false,
          error: "Scheduled email not found",
        };
      }

      // If pending, cancel it first
      if (email.status === "pending") {
        // Cancel in queue if job ID exists
        if (email.jobId) {
          await cancelScheduledEmail(email.jobId);
        }

        // Cancel in database
        await scheduledEmailService.cancel(params.id, tenant.organizationId);
      }

      // Clean up attachments before deleting
      if (email.attachments && Array.isArray(email.attachments)) {
        

        for (const attachment of email.attachments) {
          if (attachment.objectKey) {
            try {
              await attachmentUploadService.deleteAttachment(
                attachment.objectKey
              );
              console.log(
                `[Scheduled Email] Deleted attachment on cancellation: ${attachment.objectKey}`
              );
            } catch (error) {
              console.error(
                `[Scheduled Email] Failed to delete attachment ${attachment.objectKey}:`,
                error
              );
              // Continue with deletion even if attachment cleanup fails
            }
          }
        }
      }

      // Now delete from database (works for all statuses)
      const deleted = await scheduledEmailService.delete(
        params.id,
        tenant.organizationId
      );

      if (!deleted) {
        return {
          success: false,
          error: "Failed to delete scheduled email",
        };
      }

      return {
        success: true,
        message:
          email.status === "pending"
            ? "Scheduled email cancelled and deleted successfully"
            : "Scheduled email deleted successfully",
      };
    },
    {
      params: idParams,
    }
  );