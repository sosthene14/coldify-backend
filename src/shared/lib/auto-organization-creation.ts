// organization-auto-setup.ts

import { subscriptions } from "../../modules/subscriptions/subscription.schema"
import { db } from "../db"
import { member, organization as organizationTable } from "../db/schema"

export async function createPersonalOrganization(user: { id: string; name?: string | null }) {
  console.warn("[Auto-setup] Starting personal organization creation for user:", {
    id: user.id,
    name: user.name,
  })

  try {
    console.warn("[Auto-setup] Inserting organization...")
    const [org] = await db
      .insert(organizationTable)
      .values({
        id: crypto.randomUUID(),
        name: `${user.name ?? "Mon"} espace`,
        slug: `org-${user.id.slice(0, 8)}`,
        createdAt: new Date(),
      })
      .returning()

    console.warn("[Auto-setup] Organization created:", {
      id: org.id,
      name: org.name,
      slug: org.slug,
    })

    console.warn("[Auto-setup] Inserting member...")
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId: user.id,
      role: "owner",
      createdAt: new Date(),
    })

    console.warn("[Auto-setup] Member created successfully")

    // Create default free subscription for the organization
    try {
      console.warn("[Auto-setup] Creating default subscription...")
      const now = new Date()
      const oneYearFromNow = new Date(now)
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

      await db
        .insert(subscriptions)
        .values({
          id: crypto.randomUUID(),
          organizationId: org.id,
          planId: "free",
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: oneYearFromNow,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()

      console.warn("[Auto-setup] Default subscription created successfully")
    } catch (error) {
      console.error("[Auto-setup] Failed to create default subscription:", error)
      throw error // Relancer l'erreur pour diagnostiquer
    }

    console.warn("[Auto-setup] Personal organization setup completed successfully")
    return org
  } catch (error) {
    console.error("[Auto-setup] Error during personal organization creation:", error)
    throw error // Relancer l'erreur pour que Better Auth la voie
  }
}
