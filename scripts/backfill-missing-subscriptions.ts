// Script to backfill missing subscriptions for existing organizations

import { sql } from "drizzle-orm"
import { db } from "../src/shared/db"

async function backfillMissingSubscriptions() {
  console.log("Starting backfill of missing subscriptions...")

  try {
    // Find all organizations without a subscription
    const result = await db.execute(sql`
      SELECT o.id as organization_id
      FROM organization o
      LEFT JOIN subscriptions s ON o.id = s.organization_id
      WHERE s.id IS NULL
    `)

    const orgsWithoutSubscription = result || []
    console.log(`Found ${orgsWithoutSubscription.length} organizations without subscriptions`)

    if (orgsWithoutSubscription.length === 0) {
      console.log("All organizations already have subscriptions. Nothing to do.")
      return
    }

    // Create free subscriptions for organizations that don't have one
    for (const org of orgsWithoutSubscription) {
      const organizationId = org.organization_id as string
      const subscriptionId = crypto.randomUUID()

      await db.execute(sql`
        INSERT INTO subscriptions (id, organization_id, plan_id, status, created_at, updated_at)
        VALUES (${subscriptionId}, ${organizationId}, 'free', 'active', NOW(), NOW())
      `)

      console.log(`✓ Created free subscription for organization ${organizationId}`)
    }

    console.log(`\n✅ Successfully created ${orgsWithoutSubscription.length} subscriptions`)
  } catch (error) {
    console.error("❌ Error during backfill:", error)
    process.exit(1)
  }

  process.exit(0)
}

backfillMissingSubscriptions()
