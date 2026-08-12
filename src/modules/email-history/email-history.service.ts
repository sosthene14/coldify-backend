import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../../shared/db";
import { emailHistory } from "./email-history.schema";
import { nanoid } from "nanoid";
import type { EmailHistory, InsertEmailHistory } from "./email-history.schema";

export const emailHistoryService = {
  /**
   * List email history for an organization with pagination metadata
   */
  async list(
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      memberId?: string;
      mailboxId?: string;
    }
  ): Promise<{
    data: EmailHistory[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      page: number;
      totalPages: number;
    };
  }> {
    // Build where conditions
    const whereConditions = [eq(emailHistory.organizationId, organizationId)];
    
    if (options?.memberId) {
      whereConditions.push(eq(emailHistory.memberId, options.memberId));
    }
    
    if (options?.mailboxId) {
      whereConditions.push(eq(emailHistory.mailboxId, options.mailboxId));
    }

    const whereClause = whereConditions.length > 1 
      ? and(...whereConditions) 
      : whereConditions[0];

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(emailHistory)
      .where(whereClause);

    const total = totalResult?.count || 0;

    // Get paginated results
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const data = await db
      .select()
      .from(emailHistory)
      .where(whereClause)
      .orderBy(desc(emailHistory.sentAt))
      .limit(limit)
      .offset(offset);

    // Calculate pagination metadata
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
      },
    };
  },

  /**
   * Get email by ID
   */
  async getById(
    id: string,
    organizationId: string
  ): Promise<EmailHistory | null> {
    const [result] = await db
      .select()
      .from(emailHistory)
      .where(
        and(
          eq(emailHistory.id, id),
          eq(emailHistory.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  },

  /**
   * Create email history record
   */
  async create(
    data: Omit<InsertEmailHistory, "id" | "createdAt" | "updatedAt">
  ): Promise<EmailHistory> {
    const [newRecord] = await db
      .insert(emailHistory)
      .values({
        id: nanoid(),
        ...data,
      })
      .returning();

    return newRecord;
  },

  /**
   * Update email status (for scheduled emails)
   */
  async updateStatus(
    id: string,
    status: string,
    error?: string
  ): Promise<EmailHistory | null> {
    const [updated] = await db
      .update(emailHistory)
      .set({
        status,
        error: error || null,
        sentAt: status === "sent" ? new Date() : undefined,
      })
      .where(eq(emailHistory.id, id))
      .returning();

    return updated || null;
  },

  /**
   * Update email history record
   */
  async update(
    id: string,
    data: Partial<Omit<InsertEmailHistory, "id" | "createdAt" | "updatedAt">>
  ): Promise<EmailHistory | null> {
    const [updated] = await db
      .update(emailHistory)
      .set(data)
      .where(eq(emailHistory.id, id))
      .returning();

    return updated || null;
  },

  /**
   * Get statistics
   */
  async getStats(organizationId: string): Promise<{
    totalSent: number;
    sentToday: number;
    sentThisWeek: number;
    sentThisMonth: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const allEmails = await db
      .select()
      .from(emailHistory)
      .where(
        and(
          eq(emailHistory.organizationId, organizationId),
          eq(emailHistory.status, "sent")
        )
      );

    return {
      totalSent: allEmails.length,
      sentToday: allEmails.filter((e) => e.sentAt >= today).length,
      sentThisWeek: allEmails.filter((e) => e.sentAt >= weekAgo).length,
      sentThisMonth: allEmails.filter((e) => e.sentAt >= monthAgo).length,
    };
  },

  /**
   * Delete email history
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(emailHistory)
      .where(
        and(
          eq(emailHistory.id, id),
          eq(emailHistory.organizationId, organizationId)
        )
      );

    // Check if any rows were affected
    return result.length > 0;
  },
};
