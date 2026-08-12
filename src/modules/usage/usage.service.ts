import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../../shared";
import { limitPeriod, planFeature, planLimit, subscription, usageCounter } from "../../shared/db/schema";
 

type Feature = (typeof planFeature.enumValues)[number];
type Period = (typeof limitPeriod.enumValues)[number];

/** Génère la clé de bucket pour une période donnée, à la date courante */
function periodKeyFor(period: Period, at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");

  if (period === "daily") return `${y}-${m}-${d}`;
  if (period === "monthly") return `${y}-${m}`;
  return "total";
}

async function getOrgLimit(organizationId: string, feature: Feature, period: Period) {
  const [row] = await db
    .select({ limitValue: planLimit.limitValue })
    .from(subscription)
    .innerJoin(planLimit, eq(planLimit.planId, subscription.planId))
    .where(
      and(
        eq(subscription.organizationId, organizationId),
        eq(planLimit.feature, feature),
        eq(planLimit.period, period),
      ),
    )
    .limit(1);

  // pas de ligne = pas de limite définie pour ce plan -> illimité par défaut
  return row?.limitValue ?? -1;
}

export const usageService = {
  /** Consommation actuelle pour une feature/période donnée */
  async getUsage(organizationId: string, feature: Feature, period: Period) {
    const key = periodKeyFor(period);
    const [row] = await db
      .select({ count: usageCounter.count })
      .from(usageCounter)
      .where(
        and(
          eq(usageCounter.organizationId, organizationId),
          eq(usageCounter.feature, feature),
          eq(usageCounter.periodKey, key),
        ),
      )
      .limit(1);

    return row?.count ?? 0;
  },

  /**
   * Vérifie qu'on ne dépasse pas la limite, puis incrémente atomiquement.
   * Throw si la limite est atteinte -> à catcher dans le controller (429).
   */
  async checkAndIncrement(
    organizationId: string,
    feature: Feature,
    period: Period,
    amount = 1,
  ) {
    const limitValue = await getOrgLimit(organizationId, feature, period);
    const key = periodKeyFor(period);

    if (limitValue !== -1) {
      const current = await this.getUsage(organizationId, feature, period);
      if (current + amount > limitValue) {
        throw new Error(
          `Limite atteinte pour "${feature}" (${period}) : ${current}/${limitValue}`,
        );
      }
    }

    // upsert atomique: incrémente si la ligne existe déjà pour ce bucket
    const [row] = await db
      .insert(usageCounter)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        feature,
        periodKey: key,
        count: amount,
      })
      .onConflictDoUpdate({
        target: [usageCounter.organizationId, usageCounter.feature, usageCounter.periodKey],
        set: { count: sql`${usageCounter.count} + ${amount}` },
      })
      .returning();

    return row;
  },

  /**
   * Résumé consommation/limite pour toutes les features du plan courant.
   * -> exactement ce qu'il faut pour afficher "4,820 / 10,000" par ligne.
   */
  async getUsageSummary(organizationId: string) {
    const rows = await db
      .select({
        feature: planLimit.feature,
        period: planLimit.period,
        limitValue: planLimit.limitValue,
      })
      .from(subscription)
      .innerJoin(planLimit, eq(planLimit.planId, subscription.planId))
      .where(eq(subscription.organizationId, organizationId));

    return Promise.all(
      rows.map(async (r) => ({
        feature: r.feature,
        period: r.period,
        used: await this.getUsage(organizationId, r.feature, r.period),
        limit: r.limitValue, // -1 = illimité, à afficher "∞" côté front
      })),
    );
  },
};