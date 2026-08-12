import { db } from "../../shared/db";
import { scheduledEmails } from "./scheduled-email.schema";
import { eq, and, lte, gte } from "drizzle-orm";
import type { NewScheduledEmail, ScheduledEmail } from "./scheduled-email.schema";

export const scheduledEmailService = {
  /**
   * Create a new scheduled email
   */
  async create(data: NewScheduledEmail): Promise<ScheduledEmail> {
    if (data.scheduledAt <= new Date()) {
      throw new Error("scheduledAt must be in the future");
    }

    const [scheduledEmail] = await db
      .insert(scheduledEmails)
      .values(data)
      .returning();
    return scheduledEmail;
  },

  /**
   * Get scheduled email by ID
   */
  async getById(id: string, organizationId: string): Promise<ScheduledEmail | null> {
    const [scheduledEmail] = await db
      .select()
      .from(scheduledEmails)
      .where(
        and(
          eq(scheduledEmails.id, id),
          eq(scheduledEmails.organizationId, organizationId)
        )
      )
      .limit(1);

    return scheduledEmail || null;
  },

  /**
   * Get all scheduled emails for an organization
   */
  async getByOrganization(organizationId: string): Promise<ScheduledEmail[]> {
    return db
      .select()
      .from(scheduledEmails)
      .where(eq(scheduledEmails.organizationId, organizationId))
      .orderBy(scheduledEmails.scheduledAt);
  },

  /**
   * Get pending scheduled emails that are due to be sent
   */
  async getDueEmails(beforeDate: Date): Promise<ScheduledEmail[]> {
    return db
      .select()
      .from(scheduledEmails)
      .where(
        and(
          eq(scheduledEmails.status, "pending"),
          lte(scheduledEmails.scheduledAt, beforeDate)
        )
      )
      .orderBy(scheduledEmails.scheduledAt);
  },

  /**
   * Update scheduled email status
   */
  async updateStatus(
    id: string,
    status: "pending" | "processing" | "sent" | "failed" | "cancelled",
    updates?: {
      sentAt?: Date;
      failedAt?: Date;
      errorMessage?: string;
      retryCount?: number;
    }
  ): Promise<void> {
    await db
      .update(scheduledEmails)
      .set({
        status,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(scheduledEmails.id, id));
  },

  /**
   * Update job ID
   */
  async updateJobId(id: string, jobId: string): Promise<void> {
    await db
      .update(scheduledEmails)
      .set({
        jobId,
        updatedAt: new Date(),
      })
      .where(eq(scheduledEmails.id, id));
  },

  /**
   * Update scheduled email
   */
  async update(
    id: string,
    organizationId: string,
    data: Partial<NewScheduledEmail>
  ): Promise<ScheduledEmail | null> {
    const [updated] = await db
      .update(scheduledEmails)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledEmails.id, id),
          eq(scheduledEmails.organizationId, organizationId)
        )
      )
      .returning();

    return updated || null;
  },

  /**
   * Cancel scheduled email
   */
  async cancel(id: string, organizationId: string): Promise<boolean> {
    const result = await db
      .update(scheduledEmails)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledEmails.id, id),
          eq(scheduledEmails.organizationId, organizationId),
          eq(scheduledEmails.status, "pending")
        )
      );

    return result.rowCount > 0;
  },

  /**
   * Delete old scheduled emails (cleanup)
   */
  async deleteOldEmails(beforeDate: Date): Promise<number> {
    const result = await db
      .delete(scheduledEmails)
      .where(
        and(
          lte(scheduledEmails.createdAt, beforeDate),
          eq(scheduledEmails.status, "sent")
        )
      );

    return result.rowCount;
  },

  /**
   * Get scheduled emails by mailbox
   */
  async getByMailbox(mailboxId: string): Promise<ScheduledEmail[]> {
    return db
      .select()
      .from(scheduledEmails)
      .where(eq(scheduledEmails.mailboxId, mailboxId))
      .orderBy(scheduledEmails.scheduledAt);
  },

  /**
   * Get statistics for an organization
   */
  async getStats(organizationId: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    const allEmails = await this.getByOrganization(organizationId);

    return {
      total: allEmails.length,
      pending: allEmails.filter((e) => e.status === "pending").length,
      sent: allEmails.filter((e) => e.status === "sent").length,
      failed: allEmails.filter((e) => e.status === "failed").length,
      cancelled: allEmails.filter((e) => e.status === "cancelled").length,
    };
  },

  /**
   * Delete scheduled email permanently
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(scheduledEmails)
      .where(
        and(
          eq(scheduledEmails.id, id),
          eq(scheduledEmails.organizationId, organizationId)
        )
      );

    return result.length > 0;
  },
};
