import { getGmailService } from "./gmail.service";
import { mailboxService } from "./mailbox.service";
import { emailHistoryService } from "../email-history/email-history.service";
import { organizationQuotaService } from "../organization-quota/organization-quota.service";
import { minioClient, BUCKET_NAME } from "../../shared/lib/minio";
import { generateTrackingToken, injectTrackingPixel, type TrackingData } from "../../shared/lib/email-tracking";
import { decrypt } from "../../shared/lib/crypto";
import nodemailer from "nodemailer";

interface SendEmailParams {
  mailboxId: string;
  organizationId: string;
  userId?: string; // User ID for template access validation
  userRole?: string; // User role for template access validation
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  scheduledAt?: Date;
  templateId?: string; // Track which template was used
}

interface EmailAttachment {
  filename: string;
  mimeType: string;
  objectKey?: string; // MinIO object key
  content?: Buffer; // Raw content
  size: number;
}

// Gmail limits
const GMAIL_MAX_MESSAGE_SIZE = 25 * 1024 * 1024; // 25MB
const GMAIL_MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB per attachment

// Dangerous file extensions that should be blocked
export const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".pif",
  ".scr",
  ".vbs",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".msi",
  ".msp",
  ".cpl",
  ".jar",
  ".app", // macOS apps
  ".deb", // Linux packages
  ".rpm",
];

export const emailSendService = {
  /**
   * Create SMTP transporter from mailbox configuration
   */
  createSmtpTransporter(mailbox: any) {
    // Decrypt password
    const decryptedPassword = decrypt(mailbox.smtpPassword);

    return nodemailer.createTransport({
      host: mailbox.smtpHost,
      port: mailbox.smtpPort,
      secure: mailbox.smtpSecure, // true for 465, false for other ports
      auth: {
        user: mailbox.smtpUsername,
        pass: decryptedPassword,
      },
    });
  },

  /**
   * Send email via SMTP
   */
  async sendViaSmtp(
    mailbox: any,
    emailData: {
      to: string;
      from: string;
      subject: string;
      html: string;
      text?: string;
      replyTo?: string;
      attachments?: Array<{
        filename: string;
        mimeType: string;
        content: Buffer;
      }>;
    }
  ): Promise<{ messageId: string }> {
    const transporter = this.createSmtpTransporter(mailbox);

    const mailOptions: any = {
      from: `${(mailbox.metadata as any)?.displayName || mailbox.email} <${mailbox.email}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      replyTo: emailData.replyTo,
    };

    // Add attachments if any
    if (emailData.attachments && emailData.attachments.length > 0) {
      mailOptions.attachments = emailData.attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.mimeType,
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    return { messageId: info.messageId };
  },

  /**
   * Validate attachment before sending
   */
  validateAttachment(filename: string, size: number): {
    valid: boolean;
    error?: string;
  } {
    // Check size
    if (size > GMAIL_MAX_ATTACHMENT_SIZE) {
      return {
        valid: false,
        error: `Attachment "${filename}" exceeds Gmail's 25MB limit`,
      };
    }

    // Check for dangerous extensions
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && DANGEROUS_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Attachment "${filename}" has a potentially dangerous file type: ${ext}`,
      };
    }

    // Check for double extensions (e.g., file.pdf.exe)
    const parts = filename.toLowerCase().split(".");
    if (parts.length > 2) {
      const lastTwo = parts.slice(-2).join(".");
      if (DANGEROUS_EXTENSIONS.some((ext) => lastTwo.endsWith(ext.slice(1)))) {
        return {
          valid: false,
          error: `Attachment "${filename}" appears to have a hidden dangerous extension`,
        };
      }
    }

    // Check for suspicious patterns in filename
    if (filename.match(/\.(zip|rar|7z|gz|tar)$/i)) {
      // Archives are allowed but warn user they should scan them
      console.warn(
        `Archive file "${filename}" being sent. User should verify contents.`
      );
    }

    return { valid: true };
  },

  /**
   * Calculate total message size
   */
  calculateMessageSize(
    html: string,
    text: string,
    attachments: EmailAttachment[]
  ): number {
    const htmlSize = Buffer.byteLength(html, "utf8");
    const textSize = Buffer.byteLength(text, "utf8");
    const attachmentsSize = attachments.reduce((sum, att) => sum + att.size, 0);

    // Base64 encoding increases size by ~33%
    const encodedAttachmentsSize = Math.ceil(attachmentsSize * 1.33);

    return htmlSize + textSize + encodedAttachmentsSize;
  },

  /**
   * Load attachment content from MinIO
   */
  async loadAttachmentFromMinIO(objectKey: string): Promise<Buffer> {
    const bucket = BUCKET_NAME;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      minioClient.getObject(bucket, objectKey, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    });
  },

  /**
   * Send email immediately - sends individual emails to each recipient
   */
  async sendEmail(params: SendEmailParams): Promise<{
    success: boolean;
    messageId?: string;
    messageIds?: string[];
    totalSent?: number;
    error?: string;
  }> {
    try {
      // Get mailbox (with tokens for sending)
      const mailbox = await mailboxService.getByIdInternal(
        params.mailboxId,
        params.organizationId
      );

      if (!mailbox) {
        return { success: false, error: "Mailbox not found" };
      }

      if (mailbox.status !== "connected") {
        return { success: false, error: "Mailbox is not connected" };
      }

      // Check organization quota (not per-mailbox)
      const recipientCount = params.to.length;
      const quotaCheck = await organizationQuotaService.canSend(
        params.organizationId,
        recipientCount
      );

      if (!quotaCheck.allowed) {
        return {
          success: false,
          error: quotaCheck.reason || "Email quota exceeded",
        };
      }

      // Validate and load attachments (once, reuse for all emails)
      const processedAttachments: Array<{
        filename: string;
        mimeType: string;
        content: Buffer;
      }> = [];

      if (params.attachments && params.attachments.length > 0) {
        for (const attachment of params.attachments) {
          // Validate
          const validation = this.validateAttachment(
            attachment.filename,
            attachment.size
          );

          if (!validation.valid) {
            return { success: false, error: validation.error };
          }

          // Load content
          let content: Buffer;
          if (attachment.objectKey) {
            content = await this.loadAttachmentFromMinIO(attachment.objectKey);
          } else if (attachment.content) {
            content = attachment.content;
          } else {
            return {
              success: false,
              error: `No content provided for attachment: ${attachment.filename}`,
            };
          }

          processedAttachments.push({
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            content,
          });
        }

        // Check total size
        const totalSize = this.calculateMessageSize(
          params.html,
          params.text || "",
          params.attachments
        );

        if (totalSize > GMAIL_MAX_MESSAGE_SIZE) {
          return {
            success: false,
            error: `Total message size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds Gmail's 25MB limit`,
          };
        }
      }

      // Refresh token if needed (Gmail only)
      if (
        mailbox.provider === "gmail" &&
        mailbox.tokenExpiresAt &&
        new Date(mailbox.tokenExpiresAt) <= new Date()
      ) {
        const gmailService = getGmailService();
        const tokens = await gmailService.refreshAccessToken(
          mailbox.refreshToken!
        );

        await mailboxService.updateTokens(mailbox.id, {
          accessToken: tokens.accessToken,
          tokenExpiresAt: tokens.expiresAt,
        });

        mailbox.accessToken = tokens.accessToken;
      }

      const messageIds: string[] = [];
      let successCount = 0;

      // Send individual email to each recipient
      for (const recipient of params.to) {
        try {
          // Create email history entry first to get the ID for tracking
          const emailHistoryRecord = await emailHistoryService.create({
            organizationId: params.organizationId,
            memberId: mailbox.memberId,
            mailboxId: mailbox.id,
            templateId: params.templateId || null,
            from: mailbox.email,
            to: [recipient], // Single recipient
            cc: params.cc,
            bcc: params.bcc,
            subject: params.subject,
            htmlContent: params.html,
            hasAttachments: !!params.attachments && params.attachments.length > 0,
            attachmentCount: params.attachments?.length || 0,
            attachmentNames: params.attachments?.map((a) => a.filename),
            status: "pending",
            sentAt: new Date(),
          });

          // If email is created from a template, record usage and update stats
          if (params.templateId && params.userId) {
            // Import templateService to record usage
            const { templateService } = await import("../template/template.service.js");
            // Create a minimal tenant context for validation
            const tenantContext = {
              organizationId: params.organizationId,
              userId: params.userId,
              role: params.userRole as any,
              isSuperAdmin: false,
            };
            // Record usage (this will verify the user has access to the template)
            try {
              await templateService.recordUsage(tenantContext, params.templateId);
              // Also update template stats immediately after sending
              await templateService.updateTemplateStats(params.templateId);
            } catch (err) {
              console.error('[Email Send] Failed to record template usage:', err);
              // Don't fail the whole operation if template usage recording fails
            }
          }

          // Generate tracking token for this recipient
          const trackingData: TrackingData = {
            organizationId: params.organizationId,
            emailHistoryId: emailHistoryRecord.id,
            recipient,
            sentAt: new Date().toISOString(),
          };

          const trackingToken = generateTrackingToken(trackingData);

          // Inject tracking pixel into HTML
          const htmlWithTracking = injectTrackingPixel(params.html, trackingToken);

          console.log(htmlWithTracking)

          let result: { messageId: string };

          // Send via appropriate provider
          if (mailbox.provider === "smtp") {
            result = await this.sendViaSmtp(mailbox, {
              to: recipient,
              from: mailbox.email,
              subject: params.subject,
              html: htmlWithTracking,
              text: params.text,
              replyTo: params.replyTo,
              attachments: processedAttachments,
            });
          } else if (mailbox.provider === "gmail") {
            const gmailService = getGmailService();
            result = await gmailService.sendEmailWithAttachments(
              mailbox.accessToken!,
              mailbox.refreshToken!,
              {
                to: recipient,
                from: mailbox.email,
                subject: params.subject,
                html: htmlWithTracking,
                text: params.text,
                replyTo: params.replyTo,
                attachments: processedAttachments,
              }
            );
          } else {
            throw new Error(`Unsupported provider: ${mailbox.provider}`);
          }

          messageIds.push(result.messageId);
          successCount++;

          // Increment organization quota counter (instead of per-mailbox)
          await organizationQuotaService.incrementSent(params.organizationId, 1);
          
          // Also increment mailbox counter for internal stats
          await mailboxService.incrementDailySent(mailbox.id);

          // Update email history to "sent" with message ID
          await emailHistoryService.update(emailHistoryRecord.id, {
            gmailMessageId: result.messageId,
            status: "sent",
          });

          // Small delay between sends to avoid rate limiting (100ms)
          if (params.to.indexOf(recipient) < params.to.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          console.error(`Error sending email to ${recipient}:`, error);
          // Continue sending to other recipients
          // Save failed email to history
          await emailHistoryService.create({
            organizationId: params.organizationId,
            memberId: mailbox.memberId,
            mailboxId: mailbox.id,
            templateId: params.templateId || null,
            from: mailbox.email,
            to: [recipient],
            cc: params.cc,
            bcc: params.bcc,
            subject: params.subject,
            htmlContent: params.html,
            hasAttachments: !!params.attachments && params.attachments.length > 0,
            attachmentCount: params.attachments?.length || 0,
            attachmentNames: params.attachments?.map((a) => a.filename),
            status: "failed",
            sentAt: new Date(),
          });
        }
      }

      // Return success if at least one email was sent
      if (successCount > 0) {
        return {
          success: true,
          messageIds,
          totalSent: successCount,
          messageId: messageIds[0], // For backward compatibility
        };
      } else {
        return {
          success: false,
          error: "Failed to send emails to all recipients",
        };
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      return {
        success: false,
        error: error.message || "Failed to send email",
      };
    }
  },

  /**
   * Schedule email for later
   */
  async scheduleEmail(
    params: SendEmailParams
  ): Promise<{ success: boolean; scheduledId?: string; error?: string }> {
    try {
      if (!params.scheduledAt) {
        return { success: false, error: "scheduledAt is required" };
      }

      if (params.scheduledAt <= new Date()) {
        return { success: false, error: "scheduledAt must be in the future" };
      }

      // Get mailbox to validate (with tokens for scheduling)
      const mailbox = await mailboxService.getByIdInternal(
        params.mailboxId,
        params.organizationId
      );

      if (!mailbox) {
        return { success: false, error: "Mailbox not found" };
      }

      if (mailbox.status !== "connected") {
        return { success: false, error: "Mailbox is not connected" };
      }

      // Validate attachments if present
      if (params.attachments && params.attachments.length > 0) {
        for (const attachment of params.attachments) {
          const validation = this.validateAttachment(
            attachment.filename,
            attachment.size
          );

          if (!validation.valid) {
            return { success: false, error: validation.error };
          }
        }

        // Check total size
        const totalSize = this.calculateMessageSize(
          params.html,
          params.text || "",
          params.attachments
        );

        if (totalSize > GMAIL_MAX_MESSAGE_SIZE) {
          return {
            success: false,
            error: `Total message size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds Gmail's 25MB limit`,
          };
        }
      }

      // Import the service and queue here to avoid circular dependency
      const { scheduledEmailService } = await import(
        "../scheduled-email/scheduled-email.service.js"
      );
      const { addScheduledEmail } = await import(
        "../../shared/queues/scheduled-email.queue.js"
      );

      // Create scheduled email record
      const scheduledEmail = await scheduledEmailService.create({
        organizationId: params.organizationId,
        memberId: mailbox.memberId,
        mailboxId: params.mailboxId,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text,
        replyTo: params.replyTo,
        templateId: params.templateId, // Add templateId to scheduled email
        hasAttachments: !!params.attachments && params.attachments.length > 0,
        attachmentCount: params.attachments?.length || 0,
        attachments: params.attachments,
        scheduledAt: params.scheduledAt,
        status: "pending",
      });

      // Add to BullMQ queue
      const jobId = await addScheduledEmail(
        {
          scheduledEmailId: scheduledEmail.id,
          organizationId: params.organizationId,
          mailboxId: params.mailboxId,
          to: params.to,
          cc: params.cc,
          bcc: params.bcc,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo,
          templateId: params.templateId, // Add templateId to job data
          attachments: params.attachments,
        },
        params.scheduledAt
      );

      // Update scheduled email with job ID
      await scheduledEmailService.updateJobId(scheduledEmail.id, jobId);

      return {
        success: true,
        scheduledId: scheduledEmail.id,
      };
    } catch (error: any) {
      console.error("Error scheduling email:", error);
      return {
        success: false,
        error: error.message || "Failed to schedule email",
      };
    }
  },
};
