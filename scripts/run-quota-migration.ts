// Script to run organization email quota migration
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://somails:somails_dev_password@localhost:5432/somails";

async function runMigration() {
  const client = postgres(DATABASE_URL);

  try {
    console.log("🔄 Running organization email quota migration...");

    // Read migration file
    const migrationPath = join(
      __dirname,
      "../migrations/010_organization_email_quota.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Execute migration
    await client.unsafe(migrationSQL);

    console.log("✅ Migration completed successfully!");
    console.log("📊 Organization email quota table created");
    console.log("📋 Default quotas added for existing organizations");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
