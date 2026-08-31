import { db } from "../src/shared";
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";
import { seedPlans } from "../src/modules/subscriptions/seed-plans";
import { subscriptionService } from "../src/modules/subscriptions/subscription.service";
import { organization } from "../src/shared/db/schema";

async function runSubscriptionMigration() {
  console.log("🚀 Running subscription migration...");

  try {
    // 1. Run SQL migration
    console.log("📄 Applying SQL migration...");
    const migrationPath = join(__dirname, "../migrations/011_subscriptions.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    await db.execute(sql.raw(migrationSQL));
    console.log("✅ SQL migration applied");

    // 2. Seed plans
    console.log("🌱 Seeding plans...");
    await seedPlans();
    console.log("✅ Plans seeded");

    // 3. Create free subscriptions for existing organizations
    console.log("🏢 Creating subscriptions for existing organizations...");
    const organizations = await db.select().from(organization);
    
    let createdCount = 0;
    for (const org of organizations) {
      try {
        // Check if subscription already exists
        const existing = await subscriptionService.getByOrganization(org.id);
        
        if (!existing) {
          await subscriptionService.createFreeSubscription(org.id);
          createdCount++;
          console.log(`  ✓ Created free subscription for organization: ${org.name}`);
        } else {
          console.log(`  - Subscription already exists for: ${org.name}`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to create subscription for ${org.name}:`, error);
      }
    }
    
    console.log(`✅ Created ${createdCount} new subscriptions`);
    console.log("🎉 Subscription migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Execute
runSubscriptionMigration()
  .then(() => {
    console.log("Migration completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
