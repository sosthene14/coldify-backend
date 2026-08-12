import { eq, and } from "drizzle-orm";
import { lead, leadCampaignStatus, leadCustomField, leadSource, leadStatus } from "./lead.schema";
import { db, TenantContext } from "../../shared";
import { member } from "../../shared/db/schema";


type LeadStatus = (typeof leadStatus.enumValues)[number];
type LeadSource = (typeof leadSource.enumValues)[number];
type CustomField = { fieldId: string; value: string };

async function getMemberId(tenant: TenantContext) {
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

async function upsertCustomFields(
  organizationId: string,
  leadId: string,
  fields: CustomField[],
) {
  for (const f of fields) {
    await db
      .insert(leadCustomField)
      .values({
        id: crypto.randomUUID(),
        leadId,
        organizationId,
        fieldId: f.fieldId,
        value: f.value,
      })
      .onConflictDoUpdate({
        target: [leadCustomField.leadId, leadCustomField.fieldId],
        set: { value: f.value },
      });
  }
}

export const leadService = {
  /**
   * - superadmin : tous les leads, toutes organisations
   * - admin      : tous les leads de SON organisation
   * - member     : uniquement les leads dont il est owner
   * - viewer     : uniquement les leads dont il est owner (lecture seule via guard)
   */
  async list(tenant: TenantContext) {
    if (tenant.isSuperAdmin) {
      return db.select().from(lead);
    }

    if (tenant.role === "admin") {
      return db.select().from(lead).where(eq(lead.organizationId, tenant.organizationId));
    }

    const memberId = await getMemberId(tenant);
    if (!memberId) return [];

    return db
      .select()
      .from(lead)
      .where(and(eq(lead.organizationId, tenant.organizationId), eq(lead.ownerId, memberId)));
  },

  async getById(tenant: TenantContext, id: string) {
    const [row] = await db.select().from(lead).where(eq(lead.id, id)).limit(1);

    if (!row) return null;

    const authorized =
      tenant.isSuperAdmin ||
      (row.organizationId === tenant.organizationId &&
        (tenant.role === "admin" || row.ownerId === (await getMemberId(tenant))));

    if (!authorized) return null;

    const customFields = await db
      .select({ fieldId: leadCustomField.fieldId, value: leadCustomField.value })
      .from(leadCustomField)
      .where(eq(leadCustomField.leadId, id));

    return { ...row, customFields };
  },

  async create(
    tenant: TenantContext,
    data: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      jobTitle?: string;
      companyName?: string;
      source?: LeadSource;
      ownerId?: string;
      customFields?: CustomField[];
    },
  ) {
    let ownerId = await getMemberId(tenant);
    if (data.ownerId && tenant.role === "admin") {
      ownerId = data.ownerId;
    }

    const { customFields, ...leadData } = data;

    const [row] = await db
      .insert(lead)
      .values({
        ...leadData,
        organizationId: tenant.organizationId,
        ownerId,
      })
      .returning();

    if (customFields?.length) {
      await upsertCustomFields(tenant.organizationId, row.id, customFields);
    }

    return { ...row, customFields: customFields ?? [] };
  },

  async update(
    tenant: TenantContext,
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      jobTitle: string;
      companyName: string;
      status: LeadStatus;
      leadScore: number;
      tags: string[];
      notes: string;
      ownerId: string;
      customFields: CustomField[];
    }>,
  ) {
    const existing = await this.getById(tenant, id);
    if (!existing) return null;

    if (data.ownerId && tenant.role !== "admin" && !tenant.isSuperAdmin) {
      delete data.ownerId;
    }

    const { customFields, ...leadData } = data;

    const [row] = Object.keys(leadData).length
      ? await db.update(lead).set(leadData).where(eq(lead.id, id)).returning()
      : [existing];

    if (customFields?.length) {
      await upsertCustomFields(tenant.organizationId, id, customFields);
    }

    return row;
  },

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.getById(tenant, id);
    if (!existing) return null;

    await db.delete(lead).where(eq(lead.id, id));
    return existing;
  },

  // ── Statut par campagne ─────────────────────────────────────
  async listCampaignStatuses(tenant: TenantContext, leadId: string) {
    const parentLead = await this.getById(tenant, leadId);
    if (!parentLead) return null;

    return db
      .select()
      .from(leadCampaignStatus)
      .where(eq(leadCampaignStatus.leadId, leadId));
  },

  async upsertCampaignStatus(
    tenant: TenantContext,
    leadId: string,
    mailId: string,
    data: Partial<{ status: LeadStatus; sequenceStep: number }>,
  ) {
    const parentLead = await this.getById(tenant, leadId);
    if (!parentLead) return null;

    const [existing] = await db
      .select()
      .from(leadCampaignStatus)
      .where(
        and(
          eq(leadCampaignStatus.leadId, leadId),
          eq(leadCampaignStatus.mailId, mailId),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await db
        .update(leadCampaignStatus)
        .set({ ...data, lastActivityAt: new Date() })
        .where(eq(leadCampaignStatus.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await db
      .insert(leadCampaignStatus)
      .values({
        id: crypto.randomUUID(),
        leadId,
        mailId,
        status: data.status ?? "new",
        sequenceStep: data.sequenceStep ?? 0,
        lastActivityAt: new Date(),
      })
      .returning();

    return row;
  },

  // ── Filtre par champ personnalisé ────────────────────────────
  async listByCustomField(tenant: TenantContext, fieldId: string, value: string) {
    const rows = await db
      .select({ lead })
      .from(leadCustomField)
      .innerJoin(lead, eq(lead.id, leadCustomField.leadId))
      .where(
        and(
          eq(leadCustomField.organizationId, tenant.organizationId),
          eq(leadCustomField.fieldId, fieldId),
          eq(leadCustomField.value, value),
        ),
      );

    const all = rows.map((r) => r.lead);

    if (tenant.isSuperAdmin || tenant.role === "admin") return all;

    const memberId = await getMemberId(tenant);
    return all.filter((l) => l.ownerId === memberId);
  },
};