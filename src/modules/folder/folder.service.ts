import { and, eq } from "drizzle-orm"
import { db } from "../../shared"
import type { TenantContext } from "../../shared/plugins/tenant"
import { folder } from "./folder.schema"

export const folderService = {
  /**
   * - superadmin : tous les folders, toutes organisations confondues
   * - admin      : tous les folders de SON organisation
   * - member     : uniquement les folders qu'il a créés
   * - viewer     : uniquement les folders qu'il a créés (lecture seule, appliqué au niveau route)
   */
  async list(tenant: TenantContext) {
    if (tenant.isSuperAdmin) {
      return db.select().from(folder)
    }

    if (tenant.role === "admin") {
      return db.select().from(folder).where(eq(folder.organizationId, tenant.organizationId))
    }

    // member / viewer
    return db
      .select()
      .from(folder)
      .where(and(eq(folder.organizationId, tenant.organizationId), eq(folder.createdBy, tenant.userId)))
  },

  async getById(tenant: TenantContext, id: string) {
    const [row] = await db.select().from(folder).where(eq(folder.id, id)).limit(1)

    if (!row) return null
    if (tenant.isSuperAdmin) return row
    if (row.organizationId !== tenant.organizationId) return null
    if (tenant.role === "admin") return row
    if (row.createdBy !== tenant.userId) return null // member/viewer: pas le sien

    return row
  },

  async create(tenant: TenantContext, data: { id: string; name: string; description?: string }) {
    const [row] = await db
      .insert(folder)
      .values({
        ...data,
        organizationId: tenant.organizationId,
        createdBy: tenant.userId,
      })
      .returning()

    return row
  },

  async update(tenant: TenantContext, id: string, data: { name?: string; description?: string }) {
    const existing = await this.getById(tenant, id)
    if (!existing) return null

    const [row] = await db.update(folder).set(data).where(eq(folder.id, id)).returning()

    return row
  },

  async remove(tenant: TenantContext, id: string) {
    const existing = await this.getById(tenant, id)
    if (!existing) return null

    await db.delete(folder).where(eq(folder.id, id))
    return existing
  },
}
