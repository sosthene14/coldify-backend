import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { scheduledEmailService } from "../../modules/scheduled-email/scheduled-email.service";
import { emailSendService } from "../../modules/mailbox/email-send.service";
import type { ScheduledEmailJobData } from "../queues/scheduled-email.queue";

const worker = new Worker<ScheduledEmailJobData>(
  "scheduled-emails",
  async (job: Job<ScheduledEmailJobData>) => {
    const { scheduledEmailId, organizationId, mailboxId, ...emailData } = job.data;

    console.log(`[Scheduled Email Worker] Processing scheduled email: ${scheduledEmailId}`);

    try {
      // Update status to processing
      await scheduledEmailService.updateStatus(scheduledEmailId, "processing");

      // Send the email
      const result = await emailSendService.sendEmail({
        mailboxId,
        organizationId,
        ...emailData,
      });

      if (result.success) {
        // Mark as sent
        await scheduledEmailService.updateStatus(scheduledEmailId, "sent", {
          sentAt: new Date(),
        });

        // Clean up attachments after successful send
        if (emailData.attachments && Array.isArray(emailData.attachments)) {
          const { attachmentUploadService } = await import("../../modules/mailbox/attachment-upload.service.js");
          
          for (const attachment of emailData.attachments) {
            if (attachment.objectKey) {
              try {
                await attachmentUploadService.deleteAttachment(attachment.objectKey);
                console.log(`[Scheduled Email Worker] Deleted attachment after send: ${attachment.objectKey}`);
              } catch (error) {
                console.error(`[Scheduled Email Worker] Failed to delete attachment ${attachment.objectKey}:`, error);
                // Don't fail the whole job if attachment deletion fails
              }
            }
          }
        }

        console.log(
          `[Scheduled Email Worker] Successfully sent scheduled email: ${scheduledEmailId}. Sent to ${result.totalSent || 1} recipients.`
        );

        return {
          success: true,
          messageIds: result.messageIds,
          totalSent: result.totalSent,
        };
      } else {
        throw new Error(result.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error(
        `[Scheduled Email Worker] Error sending scheduled email ${scheduledEmailId}:`,
        error
      );

      // Update retry count
      const scheduledEmail = await scheduledEmailService.getById(
        scheduledEmailId,
        organizationId
      );

      const retryCount = (scheduledEmail?.retryCount || 0) + 1;

      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        // Mark as failed after all retries
        await scheduledEmailService.updateStatus(scheduledEmailId, "failed", {
          failedAt: new Date(),
          errorMessage: error.message,
          retryCount,
        });

        // Clean up attachments after permanent failure
        if (emailData.attachments && Array.isArray(emailData.attachments)) {
          const { attachmentUploadService } = await import("../../modules/mailbox/attachment-upload.service.js");
          
          for (const attachment of emailData.attachments) {
            if (attachment.objectKey) {
              try {
                await attachmentUploadService.deleteAttachment(attachment.objectKey);
                console.log(`[Scheduled Email Worker] Deleted attachment after permanent failure: ${attachment.objectKey}`);
              } catch (delError) {
                console.error(`[Scheduled Email Worker] Failed to delete attachment ${attachment.objectKey}:`, delError);
              }
            }
          }
        }
      } else {
        // Update retry count
        await scheduledEmailService.updateStatus(scheduledEmailId, "pending", {
          retryCount,
        });
      }

      throw error; // Let BullMQ handle retries
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 emails at a time
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per minute
    },
  }
);

worker.on("completed", (job) => {
  console.log(`[Scheduled Email Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Scheduled Email Worker] Job ${job?.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("[Scheduled Email Worker] Worker error:", err);
});

console.log("[Scheduled Email Worker] Started and waiting for jobs...");

export default worker;
