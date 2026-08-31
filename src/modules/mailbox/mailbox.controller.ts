import { Elysia, t } from "elysia";
import { eq, and } from "drizzle-orm";
import { db } from "../../shared/db";
import { member } from "../../shared/db/schema";
import { mailboxService } from "./mailbox.service";
import { emailSendService } from "./email-send.service";
import { attachmentUploadService } from "./attachment-upload.service";
import { getGmailService } from "./gmail.service";
import { tenantPlugin } from "../../shared/plugins/tenant";
import { nanoid } from "nanoid";
import { subscriptionService } from "../subscriptions/subscription.service";

export const mailboxController = new Elysia({ prefix: "/mailboxes" })
  .use(tenantPlugin)

  /**
   * List all mailboxes
   */
  .get("/", async ({ tenant }) => {
    const mailboxes = await mailboxService.list(tenant.organizationId);
    return mailboxes;
  })

  /**
   * Get mailbox by ID
   */
  .get("/:id", async ({ params, tenant }) => {
    const mailbox = await mailboxService.getById(
      params.id,
      tenant.organizationId
    );

    if (!mailbox) {
      return {
        error: "Mailbox not found",
        status: 404,
      };
    }

    // Don't expose sensitive tokens in response
    return {
      ...mailbox,
      accessToken: undefined,
      refreshToken: undefined,
      smtpPassword: undefined,
    };
  })

  /**
   * Initiate Gmail OAuth flow
   */
  .get("/gmail/connect", async ({ tenant }) => {
    // Check provider limit before connecting
    const canAddProvider = await subscriptionService.canAddProvider(
      tenant.organizationId
    );

    if (!canAddProvider.allowed) {
      return {
        error: canAddProvider.reason || "Cannot add more providers",
        status: 403,
      };
    }

    const gmailService = getGmailService();

    // Get member ID from database
    const [membership] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, tenant.userId),
          eq(member.organizationId, tenant.organizationId)
        )
      )
      .limit(1);

    if (!membership) {
      return {
        error: "Member not found",
        status: 404,
      };
    }

    // Create state token to validate callback
    const state = JSON.stringify({
      memberId: membership.id,
      organizationId: tenant.organizationId,
      nonce: nanoid(),
    });

    const authUrl = gmailService.getAuthUrl(
      Buffer.from(state).toString("base64")
    );

    return { authUrl };
  })

  /**
   * Gmail OAuth callback
   */
  .get("/gmail/callback", async ({ query }) => {
    try {
      const { code, state } = query as { code?: string; state?: string };

      if (!code || !state) {
        throw new Error("Missing code or state parameter");
      }

      // Decode and validate state
      const decodedState = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8")
      );
      const { memberId, organizationId } = decodedState;

      if (!memberId || !organizationId) {
        throw new Error("Invalid state parameter");
      }

      // Exchange code for tokens
      const gmailService = getGmailService();
      const tokenData = await gmailService.getTokensFromCode(code);

      // Check if mailbox already exists
      const existing = await mailboxService.getByEmail(
        tokenData.email,
        organizationId
      );

      if (existing) {
        // Update existing mailbox
        await mailboxService.updateTokens(existing.id, {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenExpiresAt: tokenData.expiresAt,
        });
      } else {
        // Create new mailbox
        await mailboxService.create({
          organizationId,
          memberId,
          email: tokenData.email,
          provider: "gmail",
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenExpiresAt: tokenData.expiresAt,
          status: "connected",
          dailyLimit: 50,
        });
      }

      // Redirect to success page
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${process.env.BETTER_AUTH_URL?.replace("3001", "3000")}/dashboard/settings?mailbox=connected`,
        },
      });
    } catch (error: any) {
      console.error("Gmail callback error:", error);

      // Redirect to error page
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${process.env.BETTER_AUTH_URL?.replace("3001", "3000")}/dashboard/settings?mailbox=error&message=${encodeURIComponent(error.message)}`,
        },
      });
    }
  })

  /**
   * Connect SMTP mailbox
   */
  .post(
    "/smtp/connect",
    async ({ body, tenant }) => {
      try {
        // Check provider limit before connecting
        const canAddProvider = await subscriptionService.canAddProvider(
          tenant.organizationId
        );

        if (!canAddProvider.allowed) {
          return {
            error: canAddProvider.reason || "Cannot add more providers",
            status: 403,
          };
        }

        // Get member ID from database
        const [membership] = await db
          .select()
          .from(member)
          .where(
            and(
              eq(member.userId, tenant.userId),
              eq(member.organizationId, tenant.organizationId)
            )
          )
          .limit(1);

        if (!membership) {
          return {
            error: "Member not found",
            status: 404,
          };
        }

        // Check if mailbox with this email already exists
        const existing = await mailboxService.getByEmail(
          body.email,
          tenant.organizationId
        );

        if (existing) {
          return {
            error: "A mailbox with this email already exists",
            status: 400,
          };
        }

        // Create SMTP mailbox (password will be encrypted in service)
        const mailbox = await mailboxService.createSmtp({
          organizationId: tenant.organizationId,
          memberId: membership.id,
          email: body.email,
          displayName: body.displayName,
          smtpHost: body.smtpHost,
          smtpPort: body.smtpPort,
          smtpUsername: body.smtpUsername,
          smtpPassword: body.smtpPassword,
          smtpSecure: body.smtpSecure,
        });

        return {
          success: true,
          mailbox: {
            ...mailbox,
            smtpPassword: undefined,
          },
        };
      } catch (error: any) {
        console.error("SMTP connection error:", error);
        return {
          error: error.message || "Failed to connect SMTP mailbox",
          status: 500,
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        displayName: t.Optional(t.String()),
        smtpHost: t.String({ minLength: 1 }),
        smtpPort: t.Number({ minimum: 1, maximum: 65535 }),
        smtpUsername: t.String({ minLength: 1 }),
        smtpPassword: t.String({ minLength: 1 }),
        smtpSecure: t.Boolean(),
      }),
    }
  )

  /**
   * Update SMTP mailbox configuration
   */
  .patch(
    "/:id/smtp",
    async ({ params, body, tenant }) => {
      try {
        // Get the mailbox first to verify it's SMTP
        const existing = await mailboxService.getById(
          params.id,
          tenant.organizationId
        );

        if (!existing) {
          return {
            error: "Mailbox not found",
            status: 404,
          };
        }

        if (existing.provider !== "smtp") {
          return {
            error: "Only SMTP mailboxes can be updated via this endpoint",
            status: 400,
          };
        }

        // Update SMTP configuration (password will be encrypted if provided)
        const updated = await mailboxService.updateSmtp(
          params.id,
          tenant.organizationId,
          {
            displayName: body.displayName,
            smtpHost: body.smtpHost,
            smtpPort: body.smtpPort,
            smtpUsername: body.smtpUsername,
            smtpPassword: body.smtpPassword,
            smtpSecure: body.smtpSecure,
          }
        );

        if (!updated) {
          return {
            error: "Failed to update mailbox",
            status: 500,
          };
        }

        return {
          success: true,
          mailbox: {
            ...updated,
            accessToken: undefined,
            refreshToken: undefined,
            smtpPassword: undefined,
          },
        };
      } catch (error: any) {
        console.error("SMTP update error:", error);
        return {
          error: error.message || "Failed to update SMTP mailbox",
          status: 500,
        };
      }
    },
    {
      body: t.Object({
        displayName: t.Optional(t.String()),
        smtpHost: t.Optional(t.String({ minLength: 1 })),
        smtpPort: t.Optional(t.Number({ minimum: 1, maximum: 65535 })),
        smtpUsername: t.Optional(t.String({ minLength: 1 })),
        smtpPassword: t.Optional(t.String({ minLength: 1 })),
        smtpSecure: t.Optional(t.Boolean()),
      }),
    }
  )

  /**
   * Disconnect mailbox
   */
  .delete("/:id", async ({ params, tenant }) => {
    const deleted = await mailboxService.delete(
      params.id,
      tenant.organizationId
    );

    if (!deleted) {
      return {
        error: "Mailbox not found",
        status: 404,
      };
    }

    return { success: true };
  })

  /**
   * Update mailbox signature
   */
  .patch(
    "/:id/signature",
    async ({ params, body, tenant }) => {
      const updated = await mailboxService.updateSignature(
        params.id,
        tenant.organizationId,
        body.signature
      );

      if (!updated) {
        return {
          error: "Mailbox not found",
          status: 404,
        };
      }

      return {
        ...updated,
        accessToken: undefined,
        refreshToken: undefined,
        smtpPassword: undefined,
      };
    },
    {
      body: t.Object({
        signature: t.String(),
      }),
    }
  )

  /**
   * Update daily limit
   */
  .patch(
    "/:id/daily-limit",
    async ({ params, body, tenant }) => {
      const updated = await mailboxService.updateDailyLimit(
        params.id,
        tenant.organizationId,
        body.dailyLimit
      );

      if (!updated) {
        return {
          error: "Mailbox not found",
          status: 404,
        };
      }

      return {
        ...updated,
        accessToken: undefined,
        refreshToken: undefined,
        smtpPassword: undefined,
      };
    },
    {
      body: t.Object({
        dailyLimit: t.Number({ minimum: 1, maximum: 500 }),
      }),
    }
  )

  /**
   * Test mailbox connection
   */
  .post("/:id/test", async ({ params, tenant }) => {
    const mailbox = await mailboxService.getById(
      params.id,
      tenant.organizationId
    );

    if (!mailbox) {
      return {
        error: "Mailbox not found",
        status: 404,
      };
    }

    if (mailbox.provider === "gmail") {
      const gmailService = getGmailService();
     
      const result = await gmailService.verifyConnection(
         //@ts-ignore type mismatch
        mailbox.accessToken || "",
         //@ts-ignore type mismatch
        mailbox.refreshToken || null
      );

      if (result.valid) {
        await mailboxService.updateStatus(mailbox.id, "connected");
        return { success: true, message: "Mailbox connection is valid" };
      } else {
        await mailboxService.updateStatus(
          mailbox.id,
          "error",
          "Connection test failed"
        );
        return {
          error: "Connection test failed",
          status: 400,
        };
      }
    }

    return {
      error: "Provider not supported for testing",
      status: 400,
    };
  })

  /**
   * Upload attachment for email
   */
  .post(
    "/upload-attachment",
    async ({ body, tenant }) => {
      try {
        // Get member ID
        const [membership] = await db
          .select()
          .from(member)
          .where(
            and(
              eq(member.userId, tenant.userId),
              eq(member.organizationId, tenant.organizationId)
            )
          )
          .limit(1);

        if (!membership) {
          return {
            error: "Member not found",
            status: 404,
          };
        }

        // Decode base64 file content
        const fileBuffer = Buffer.from(body.content, "base64");

        // Upload to MinIO
        const result = await attachmentUploadService.uploadAttachment({
          organizationId: tenant.organizationId,
          memberId: membership.id,
          file: fileBuffer,
          filename: body.filename,
          mimeType: body.mimeType,
        });

        return {
          objectKey: result.objectKey,
          url: result.url,
        };
      } catch (error: any) {
        console.error("Attachment upload error:", error);
        return {
          error: error.message || "Failed to upload attachment",
          status: 500,
        };
      }
    },
    {
      body: t.Object({
        filename: t.String(),
        mimeType: t.String(),
        content: t.String(), // Base64 encoded file content
      }),
    }
  )

  /**
   * Send email
   */
  .post(
    "/send",
    async ({ body, tenant,set }) => {
      const result = await emailSendService.sendEmail({
        mailboxId: body.mailboxId,
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        userRole: tenant.role,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        html: body.html,
        text: body.text,
        replyTo: body.replyTo,
        templateId: body.templateId,
        attachments: body.attachments,
      });

      if (!result.success) {
      set.status = 400;   // <- ça, c'est le vrai status HTTP
      return {
        error: result.error,
      };
    }

      // Delete attachments after successful send
      if (body.attachments) {
        for (const attachment of body.attachments) {
          if (attachment.objectKey) {
            await attachmentUploadService.deleteAttachment(
              attachment.objectKey
            );
          }
        }
      }

      return {
        success: true,
        messageId: result.messageId,
        messageIds: result.messageIds,
        totalSent: result.totalSent,
      };
    },
    {
      body: t.Object({
        mailboxId: t.String(),
        to: t.Array(t.String({ format: "email" })),
        cc: t.Optional(t.Array(t.String({ format: "email" }))),
        bcc: t.Optional(t.Array(t.String({ format: "email" }))),
        subject: t.String({ minLength: 1 }),
        html: t.String({ minLength: 1 }),
        text: t.Optional(t.String()),
        replyTo: t.Optional(t.String({ format: "email" })),
        templateId: t.Optional(t.String()),
        attachments: t.Optional(
          t.Array(
            t.Object({
              filename: t.String(),
              mimeType: t.String(),
              objectKey: t.Optional(t.String()),
              size: t.Number(),
            })
          )
        ),
      }),
    }
  )

  /**
   * Schedule email
   */
  .post(
    "/schedule",
    async ({ body, tenant }) => {
      // Log timezone information for debugging
      if (body.timezone) {
        console.log(`[Schedule Email] User timezone: ${body.timezone}, Scheduled for: ${body.scheduledAt}`);
      }

      const result = await emailSendService.scheduleEmail({
        mailboxId: body.mailboxId,
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        userRole: tenant.role,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        html: body.html,
        text: body.text,
        replyTo: body.replyTo,
        templateId: body.templateId,
        attachments: body.attachments,
        scheduledAt: new Date(body.scheduledAt),
        timezone: body.timezone, // Pass timezone to service
      });

      if (!result.success) {
        return {
          error: result.error,
          status: 400,
        };
      }

      return {
        success: true,
        scheduledId: result.scheduledId,
      };
    },
    {
      body: t.Object({
        mailboxId: t.String(),
        to: t.Array(t.String({ format: "email" })),
        cc: t.Optional(t.Array(t.String({ format: "email" }))),
        bcc: t.Optional(t.Array(t.String({ format: "email" }))),
        subject: t.String({ minLength: 1 }),
        html: t.String({ minLength: 1 }),
        text: t.Optional(t.String()),
        replyTo: t.Optional(t.String({ format: "email" })),
        templateId: t.Optional(t.String()),
        scheduledAt: t.String(), // ISO date string
        timezone: t.Optional(t.String()), // User's timezone (e.g., 'America/New_York')
        attachments: t.Optional(
          t.Array(
            t.Object({
              filename: t.String(),
              mimeType: t.String(),
              objectKey: t.Optional(t.String()),
              size: t.Number(),
            })
          )
        ),
      }),
    }
  );
