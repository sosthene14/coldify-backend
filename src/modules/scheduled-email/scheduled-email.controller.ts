import { Elysia, t } from "elysia";
import { scheduledEmailService } from "./scheduled-email.service";
import { cancelScheduledEmail } from "../../shared/queues/scheduled-email.queue";
import { tenantPlugin } from "../../shared/plugins/tenant";

export const scheduledEmailController = new Elysia({ prefix: "/scheduled-emails" })
  .use(tenantPlugin)

  // Get all scheduled emails for organization
  .get("/", async ({ tenant }) => {
    const emails = await scheduledEmailService.getByOrganization(
      tenant.organizationId
    );
    return emails;
  })

  // Get scheduled email by ID
  .get("/:id", async ({ params, tenant }) => {
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
  })

  // Update scheduled email
  .patch("/:id", async ({ params, body, tenant }) => {
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
        attachments: body.attachments,
        hasAttachments: body.attachments && body.attachments.length > 0,
        attachmentCount: body.attachments?.length || 0,
      }
    );

    if (!updated) {
      return {
        success: false,
        error: "Failed to update scheduled email",
      };
    }

    // Create new job with updated data
    const { addScheduledEmail } = await import(
      "../../shared/queues/scheduled-email.queue"
    );

    const jobId = await addScheduledEmail(
      {
        scheduledEmailId: updated.id,
        organizationId: tenant.organizationId,
        mailboxId: updated.mailboxId,
        to: updated.to as string[],
        cc: updated.cc as string[] | undefined,
        bcc: updated.bcc as string[] | undefined,
        subject: updated.subject,
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
  })

  // Delete scheduled email (cancel if pending, delete if already cancelled/failed/sent)
  .delete("/:id", async ({ params, tenant }) => {
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
      await scheduledEmailService.cancel(
        params.id,
        tenant.organizationId
      );
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
      message: email.status === "pending" 
        ? "Scheduled email cancelled and deleted successfully"
        : "Scheduled email deleted successfully",
    };
  })

  // Get statistics
  .get("/stats", async ({ tenant }) => {
    const stats = await scheduledEmailService.getStats(
      tenant.organizationId
    );
    return stats;
  });
