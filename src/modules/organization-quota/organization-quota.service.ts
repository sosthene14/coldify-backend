import { eq } from "drizzle-orm";
import { db } from "../../shared/db";
import { organizationEmailQuota } from "../../shared/db/schema/organization-quota";
import { nanoid } from "nanoid";
import type { OrganizationEmailQuota } from "../../shared/db/schema/organization-quota";
import { subscriptionService } from "../subscriptions/subscription.service";

export const organizationQuotaService = {
  /**
   * Get quota for an organization (create if doesn't exist)
   * Now uses subscription limits as defaults
   */
  async getOrCreate(organizationId: string): Promise<OrganizationEmailQuota> {
    const [existing] = await db
      .select()
      .from(organizationEmailQuota)
      .where(eq(organizationEmailQuota.organizationId, organizationId))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Get limits from subscription plan
    const limits = await subscriptionService.getEmailLimits(organizationId);

    // Create default quota based on subscription
    const [created] = await db
      .insert(organizationEmailQuota)
      .values({
        id: `quota_${nanoid()}`,
        organizationId,
        dailyLimit: limits.dailyLimit,
        monthlyLimit: limits.monthlyLimit,
      })
      .returning();

    return created;
  },

  /**
   * Check if organization can send emails
   */
  async canSend(
    organizationId: string,
    count: number = 1
  ): Promise<{ allowed: boolean; reason?: string; quota?: OrganizationEmailQuota }> {
    const quota = await this.getOrCreate(organizationId);

    // Check if we need to reset daily counter
    const now = new Date();
    const lastReset = new Date(quota.lastResetAt);
    const shouldResetDaily =
      now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000;

    // Check if we need to reset monthly counter
    const monthlyReset = new Date(quota.monthlyResetAt);
    const shouldResetMonthly =
      now.getMonth() !== monthlyReset.getMonth() ||
      now.getFullYear() !== monthlyReset.getFullYear();

    let currentDailySent = quota.dailySent;
    let currentMonthlySent = quota.monthlySent;

    if (shouldResetDaily) {
      currentDailySent = 0;
    }
    if (shouldResetMonthly) {
      currentMonthlySent = 0;
    }

    // Check daily limit
    if (currentDailySent + count > quota.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit reached (${quota.dailyLimit} emails/day)`,
        quota,
      };
    }

    // Check monthly limit if set
    if (
      quota.monthlyLimit !== null &&
      currentMonthlySent + count > quota.monthlyLimit
    ) {
      return {
        allowed: false,
        reason: `Monthly limit reached (${quota.monthlyLimit} emails/month)`,
        quota,
      };
    }

    return { allowed: true, quota };
  },

  /**
   * Increment sent counter
   */
  async incrementSent(organizationId: string, count: number = 1): Promise<void> {
    const quota = await this.getOrCreate(organizationId);

    const now = new Date();
    const lastReset = new Date(quota.lastResetAt);
    const shouldResetDaily =
      now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000;

    const monthlyReset = new Date(quota.monthlyResetAt);
    const shouldResetMonthly =
      now.getMonth() !== monthlyReset.getMonth() ||
      now.getFullYear() !== monthlyReset.getFullYear();

    if (shouldResetDaily && shouldResetMonthly) {
      // Reset both counters
      await db
        .update(organizationEmailQuota)
        .set({
          dailySent: count,
          monthlySent: count,
          totalSent: quota.totalSent + count,
          lastResetAt: now,
          monthlyResetAt: now,
        })
        .where(eq(organizationEmailQuota.id, quota.id));
    } else if (shouldResetDaily) {
      // Reset only daily counter
      await db
        .update(organizationEmailQuota)
        .set({
          dailySent: count,
          monthlySent: quota.monthlySent + count,
          totalSent: quota.totalSent + count,
          lastResetAt: now,
        })
        .where(eq(organizationEmailQuota.id, quota.id));
    } else if (shouldResetMonthly) {
      // Reset only monthly counter
      await db
        .update(organizationEmailQuota)
        .set({
          dailySent: quota.dailySent + count,
          monthlySent: count,
          totalSent: quota.totalSent + count,
          monthlyResetAt: now,
        })
        .where(eq(organizationEmailQuota.id, quota.id));
    } else {
      // Just increment
      await db
        .update(organizationEmailQuota)
        .set({
          dailySent: quota.dailySent + count,
          monthlySent: quota.monthlySent + count,
          totalSent: quota.totalSent + count,
        })
        .where(eq(organizationEmailQuota.id, quota.id));
    }
  },

  /**
   * Update limits
   */
  async updateLimits(
    organizationId: string,
    limits: { dailyLimit?: number; monthlyLimit?: number | null }
  ): Promise<OrganizationEmailQuota | null> {
    const quota = await this.getOrCreate(organizationId);

    const updateData: any = {};
    if (limits.dailyLimit !== undefined) {
      updateData.dailyLimit = limits.dailyLimit;
    }
    if (limits.monthlyLimit !== undefined) {
      updateData.monthlyLimit = limits.monthlyLimit;
    }

    const [updated] = await db
      .update(organizationEmailQuota)
      .set(updateData)
      .where(eq(organizationEmailQuota.id, quota.id))
      .returning();

    return updated || null;
  },

  /**
   * Get quota stats
   */
  async getStats(organizationId: string): Promise<{
    dailyUsed: number;
    dailyLimit: number;
    dailyRemaining: number;
    monthlyUsed: number;
    monthlyLimit: number | null;
    monthlyRemaining: number | null;
    totalSent: number;
  }> {
    const quota = await this.getOrCreate(organizationId);

    // Check if we need to reset
    const now = new Date();
    const lastReset = new Date(quota.lastResetAt);
    const shouldResetDaily =
      now.getTime() - lastReset.getTime() > 24 * 60 * 60 * 1000;

    const monthlyReset = new Date(quota.monthlyResetAt);
    const shouldResetMonthly =
      now.getMonth() !== monthlyReset.getMonth() ||
      now.getFullYear() !== monthlyReset.getFullYear();

    const dailyUsed = shouldResetDaily ? 0 : quota.dailySent;
    const monthlyUsed = shouldResetMonthly ? 0 : quota.monthlySent;

    return {
      dailyUsed,
      dailyLimit: quota.dailyLimit,
      dailyRemaining: quota.dailyLimit - dailyUsed,
      monthlyUsed,
      monthlyLimit: quota.monthlyLimit,
      monthlyRemaining:
        quota.monthlyLimit !== null ? quota.monthlyLimit - monthlyUsed : null,
      totalSent: quota.totalSent,
    };
  },
};
