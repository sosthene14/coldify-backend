import { and, eq } from "drizzle-orm"
import { db, type TenantContext } from "../../shared"
import { member } from "../../shared/db/schema"
import { type customFieldType, organizationCustomField } from "./organization-custom-field.schema"

type CustomFieldType = (typeof customFieldType.enumValues)[number]

async function getMemberId(tenant: TenantContext) {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, tenant.userId), eq(member.organizationId, tenant.organizationId)))
    .limit(1)

  return row?.id ?? null
}

export const organizationCustomFieldService = {
  /** Lecture: tout le monde dans l'org (même viewer, pour afficher les colonnes) */
  async list(tenant: TenantContext) {
    return db
      .select()
      .from(organizationCustomField)
      .where(eq(organizationCustomField.organizationId, tenant.organizationId))
      .orderBy(organizationCustomField.position)
  },

  async getById(tenant: TenantContext, id: string) {
    const [row] = await db.select().from(organizationCustomField).where(eq(organizationCustomField.id, id)).limit(1)

    if (!row || row.organizationId !== tenant.organizationId) return null
    return row
  },

  /** Écriture: réservée aux admin (et superadmin), c'est une définition partagée */
  async create(
    tenant: TenantContext,
    data: {
      id: string
      name: string
      fieldType: CustomFieldType
      options?: string[]
      isRequired?: boolean
      position?: number
    },
  ) {
    if (!tenant.isSuperAdmin && tenant.role !== "admin") return "forbidden" as const

    const memberId = await getMemberId(tenant)
    if (!memberId) throw new Error("Aucun membership trouvé pour cet utilisateur")

    const [row] = await db
      .insert(organizationCustomField)
      .values({ ...data, organizationId: tenant.organizationId, createdBy: memberId })
      .returning()

    return row
  },

  async update(
    tenant: TenantContext,
    id: string,
    data: Partial<{
      name: string
      fieldType: CustomFieldType
      options: string[]
      isRequired: boolean
      position: number
    }>,
  ) {
    if (!tenant.isSuperAdmin && tenant.role !== "admin") return "forbidden" as const

    const existing = await this.getById(tenant, id)
    if (!existing) return null

    const [row] = await db
      .update(organizationCustomField)
      .set(data)
      .where(eq(organizationCustomField.id, id))
      .returning()

    return row
  },

  async remove(tenant: TenantContext, id: string) {
    if (!tenant.isSuperAdmin && tenant.role !== "admin") return "forbidden" as const

    const existing = await this.getById(tenant, id)
    if (!existing) return null

    // les valeurs lead_custom_field associées partent en cascade (onDelete: cascade)
    await db.delete(organizationCustomField).where(eq(organizationCustomField.id, id))
    return existing
  },
}
