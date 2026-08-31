import { eq, and, desc } from "drizzle-orm";
import { db } from "../../shared/db";
import { mailbox } from "./mailbox.schema";
import { nanoid } from "nanoid";
import type { Mailbox, InsertMailbox } from "./mailbox.schema";
import { encrypt } from "../../shared/lib/crypto";

// Type for safe mailbox data (without sensitive tokens)
export type SafeMailbox = Omit<Mailbox, "accessToken" | "refreshToken" | "smtpPassword">;

/**
 * Remove sensitive data from mailbox object
 */
function sanitizeMailbox(mb: Mailbox): SafeMailbox {
  const { accessToken, refreshToken, smtpPassword, ...safe } = mb;
  return safe;
}

export const mailboxService = {
  /**
   * List all mailboxes for an organization (without sensitive data)
   */
  async list(organizationId: string): Promise<SafeMailbox[]> {
    const mailboxes = await db
      .select()
      .from(mailbox)
      .where(eq(mailbox.organizationId, organizationId))
      .orderBy(desc(mailbox.createdAt));
    
    return mailboxes.map(sanitizeMailbox);
  },

  /**
   * Get a specific mailbox by ID (without sensitive data for API responses)
   */
  async getById(id: string, organizationId: string): Promise<SafeMailbox | null> {
    const result = await this.getByIdInternal(id, organizationId);
    return result ? sanitizeMailbox(result) : null;
  },

  /**
   * Internal method to get mailbox with all data (including tokens)
   * Should ONLY be used by backend services, never exposed to API
   */
  async getByIdInternal(id: string, organizationId: string): Promise<Mailbox | null> {
    const [result] = await db
      .select()
      .from(mailbox)
      .where(
        and(
          eq(mailbox.id, id),
          eq(mailbox.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  },

  /**
   * Get mailbox by email
   */
  async getByEmail(email: string, organizationId: string): Promise<Mailbox | null> {
    const [result] = await db
      .select()
      .from(mailbox)
      .where(
        and(
          eq(mailbox.email, email),
          eq(mailbox.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  },

  /**
   * Create a new mailbox
   */
  async create(data: Omit<InsertMailbox, "id" | "createdAt" | "updatedAt">): Promise<Mailbox> {
    const [newMailbox] = await db
      .insert(mailbox)
      .values({
        id: nanoid(),
        ...data,
      })
      .returning();

    return newMailbox;
  },

  /**
   * Create SMTP mailbox with encrypted password
   */
  async createSmtp(data: {
    organizationId: string;
    memberId: string;
    email: string;
    displayName?: string;
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    smtpSecure: boolean;
  }): Promise<Mailbox> {
    // Encrypt the SMTP password
    const encryptedPassword = encrypt(data.smtpPassword);

    const [newMailbox] = await db
      .insert(mailbox)
      .values({
        id: nanoid(),
        organizationId: data.organizationId,
        memberId: data.memberId,
        email: data.email,
        provider: "smtp",
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUsername: data.smtpUsername,
        smtpPassword: encryptedPassword,
        smtpSecure: data.smtpSecure,
        status: "connected", // Will be validated on first send
        dailyLimit: 100, // Default limit for SMTP
        metadata: data.displayName ? { displayName: data.displayName } : null,
      })
      .returning();

    return newMailbox;
  },

  /**
   * Update mailbox tokens (OAuth refresh)
   */
  async updateTokens(
    id: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt: Date;
    }
  ): Promise<Mailbox | null> {
    const [updated] = await db
      .update(mailbox)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || undefined,
        tokenExpiresAt: tokens.tokenExpiresAt,
        status: "connected",
        lastError: null,
        lastSyncAt: new Date(),
      })
      .where(eq(mailbox.id, id))
      .returning();

    return updated || null;
  },

  /**
   * Update SMTP mailbox configuration
   */
  async updateSmtp(
    id: string,
    organizationId: string,
    data: {
      displayName?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUsername?: string;
      smtpPassword?: string;
      smtpSecure?: boolean;
    }
  ): Promise<Mailbox | null> {
    const updateData: any = {};

    if (data.displayName !== undefined) {
      // Store displayName in metadata
      const [current] = await db
        .select()
        .from(mailbox)
        .where(
          and(
            eq(mailbox.id, id),
            eq(mailbox.organizationId, organizationId)
          )
        )
        .limit(1);

      if (current) {
        updateData.metadata = {
          ...(current.metadata as any),
          displayName: data.displayName,
        };
      }
    }

    if (data.smtpHost !== undefined) updateData.smtpHost = data.smtpHost;
    if (data.smtpPort !== undefined) updateData.smtpPort = data.smtpPort;
    if (data.smtpUsername !== undefined) updateData.smtpUsername = data.smtpUsername;
    if (data.smtpPassword !== undefined) {
      // Encrypt the new password
      updateData.smtpPassword = encrypt(data.smtpPassword);
    }
    if (data.smtpSecure !== undefined) updateData.smtpSecure = data.smtpSecure;

    const [updated] = await db
      .update(mailbox)
      .set(updateData)
      .where(
        and(
          eq(mailbox.id, id),
          eq(mailbox.organizationId, organizationId)
        )
      )
      .returning();

    return updated || null;
  },

  /**
   * Update mailbox status
   */
  async updateStatus(
    id: string,
    status: string,
    error?: string
  ): Promise<Mailbox | null> {
    const [updated] = await db
      .update(mailbox)
      .set({
        status,
        lastError: error || null,
        lastSyncAt: new Date(),
      })
      .where(eq(mailbox.id, id))
      .returning();

    return updated || null;
  },

  /**
   * Increment daily sent counter
   */
  async incrementDailySent(id: string): Promise<void> {
    const [current] = await db
      .select()
      .from(mailbox)
      .where(eq(mailbox.id, id))
      .limit(1);

    if (!current) return;

    // Check if we need to reset the counter (new day)
    const lastReset = current.lastResetAt;
    const now = new Date();
    const shouldReset =
      !lastReset ||
      now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000;

    if (shouldReset) {
      await db
        .update(mailbox)
        .set({
          dailySent: 1,
          lastResetAt: now,
        })
        .where(eq(mailbox.id, id));
    } else {
      await db
        .update(mailbox)
        .set({
          dailySent: current.dailySent + 1,
        })
        .where(eq(mailbox.id, id));
    }
  },

  /**
   * Update signature
   */
  async updateSignature(
    id: string,
    organizationId: string,
    signature: string
  ): Promise<Mailbox | null> {
    const [updated] = await db
      .update(mailbox)
      .set({ signature })
      .where(
        and(
          eq(mailbox.id, id),
          eq(mailbox.organizationId, organizationId)
        )
      )
      .returning();

    return updated || null;
  },

  /**
   * Update daily limit
   */
  async updateDailyLimit(
    id: string,
    organizationId: string,
    dailyLimit: number
  ): Promise<Mailbox | null> {
    const [updated] = await db
      .update(mailbox)
      .set({ dailyLimit })
      .where(
        and(
          eq(mailbox.id, id),
          eq(mailbox.organizationId, organizationId)
        )
      )
      .returning();

    return updated || null;
  },

  /**
   * Delete mailbox
   */
  async delete(id: string, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(mailbox)
      .where(
        and(
          eq(mailbox.id, id),
          eq(mailbox.organizationId, organizationId)
        )
      );

    //@ts-ignore type mismatch
    return result.rowCount !== null && result.rowCount > 0;
  },

  /**
   * Get available mailboxes for sending (connected, under daily limit)
   */
  async getAvailableForSending(organizationId: string): Promise<Mailbox[]> {
    const allMailboxes = await this.list(organizationId);
    
    //@ts-ignore type mismatch
    return allMailboxes.filter((mb) => {
      if (mb.status !== "connected") return false;

      // Check daily limit
      const lastReset = mb.lastResetAt;
      const now = new Date();
      const shouldReset =
        !lastReset ||
        now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000;

      if (shouldReset) return true;

      return mb.dailySent < mb.dailyLimit;
    });
  },
};
