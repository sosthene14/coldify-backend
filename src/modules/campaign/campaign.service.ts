import { eq, and } from "drizzle-orm";
import { campaign, campaignStatus } from "./campaign.schema";
import { db, TenantContext } from "../../shared";
import { member } from "../../shared/db/schema";

type CampaignStatus = (typeof campaignStatus.enumValues)[number];

async function getMemberId(tenant: TenantContext) {
  // superadmin agit "en tant qu'admin" sur l'org courante mais n'a pas forcément
  // de ligne member -> on tente de la récupérer, sinon on retombe sur userId
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.userId, tenant.userId),
        eq(member.organizationId, tenant.organizationId),
      ),
    )
    .limit(1);

  return row?.id ?? null;
}

export const campaignService = {
  /**
   * - superadmin : toutes les campagnes, toutes organisations
   * - admin      : toutes les campagnes de SON organisation
   * - member     : uniquement les campagnes qu'il a créées
   * - viewer     : uniquement les campagnes qu'il a créées (lecture seule via guard)
   */
  async list(tenant: TenantContext) {
    if (tenant.isSuperAdmin) {
      return db.select().from(campaign);
    }

    if (tenant.role === "admin") {
      return db
        .select()
        .from(campaign)
        .where(eq(campaign.organizationId, tenant.organizationId));
    }

    const memberId = await getMemberId(tenant);
    if (!memberId) return [];

    return db
      .select()
      .from(campaign)
      .where(
        and(
          eq(campaign.organizationId, tenant.organizationId),
          eq(campaign.createdBy, memberId),
        ),
      );
  },

  async getById(tenant: TenantContext, id: string) {
    const [row] = await db
      .select()
      .from(campaign)
      .where(eq(campaign.id, id))
      .limit(1);

    if (!row) return null;
    if (tenant.isSuperAdmin) return row;
    if (row.organizationId !== tenant.organizationId) return null;
    if (tenant.role === "admin") return row;

    const memberId = await getMemberId(tenant);
    if (row.createdBy !== memberId) return null;

    return row;
  },

  async create(
    tenant: TenantContext,
    data: { id: string; name: string; status?: CampaignStatus },
  ) {
    const memberId = await getMemberId(tenant);
    if (!memberId) throw new Error("Aucun membership trouvé pour cet utilisateur");

    const [row] = await db
      .insert(campaign)
      .values({
        ...data,
        organizationId: tenant.organizationId,
        createdBy: memberId,
      })
      .returning();

    return row;
  },

  async update(
    tenant: TenantContext,
    id: string,
    data: { name?: string; status?: CampaignStatus },
  ) {
    const existing = await this.getById(tenant, id);
    if (!existing) return null;

    const [row] = await db
      .update(campaign)
      .set(data)
      .where(eq(campaign.id, id))
      .returning();

    return row;
  },

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.getById(tenant, id);
    if (!existing) return null;

    await db.delete(campaign).where(eq(campaign.id, id));
    return existing;
  },
};