import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { subscriptionService } from "../../modules/subscriptions/subscription.service"
import { db } from "../db"
import { member, organization as organizationTable } from "../db/schema"

export async function createPersonalOrganization(user: {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}) {
  try {
    // Check if user already has an organization
    const existingMember = await db.select({ id: member.id }).from(member).where(eq(member.userId, user.id)).limit(1)

    if (existingMember.length > 0) {
      console.log(`[Organization] User ${user.email} already has an organization`)
      return null
    }

    // Create organization name from user's first/last name or email
    let organizationName = "Mon Organisation"
    if (user.firstName || user.lastName) {
      organizationName = `${user.firstName || ""} ${user.lastName || ""}`.trim()
      if (organizationName === "") {
        organizationName = user.email.split("@")[0]
      }
    } else {
      organizationName = user.email.split("@")[0]
    }

    // Add team suffix
    organizationName = `${organizationName}'s Team`

    // Generate unique identifiers
    const organizationId = nanoid()
    const randomSuffix = nanoid(6)
    const slug = `${organizationName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${randomSuffix}`
    const now = new Date()

    // Create organization
    //@ts-nocheck type mismatch
   const [createdOrg] = await db
  .insert(organizationTable)
  .values({
    id: organizationId,
    name: organizationName,
    slug: slug,
    metadata: JSON.stringify({}),
    createdAt: now,
  })
  .returning()

    // Create member record to link user to organization as admin
    const memberId = nanoid()
    await db.insert(member).values({
      id: memberId,
      organizationId,
      userId: user.id,
      role: "admin",
      createdAt: now,
    })

    // Create free subscription for the organization
    await subscriptionService.createFreeSubscription(organizationId)

    console.log(`[Organization] Created personal organization "${organizationName}" for user ${user.email}`)
    return createdOrg
  } catch (error) {
    console.error("[Organization] Failed to create personal organization:", error)
    throw error
  }
}
