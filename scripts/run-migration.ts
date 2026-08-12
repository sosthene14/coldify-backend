// Script to run migration manually
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://coldy:coldy_dev_password@localhost:5432/coldy";

async function runMigration() {
  const client = postgres(DATABASE_URL);

  try {
    console.log("🔄 Running email history table migration...");

    // Read migration file
    const migrationPath = join(
      __dirname,
      "../src/shared/db/migrations/0002_add_email_history_table.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Execute migration
    await client.unsafe(migrationSQL);

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
