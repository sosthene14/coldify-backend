// Script to run two_factor migration

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://somails:somails_dev_password@localhost:5432/somails";

async function runMigration() {
  const client = postgres(DATABASE_URL)

  try {
    console.log("🔄 Running two_factor table migration...")

    // Read migration file
    const migrationPath = join(__dirname, "../src/shared/db/migrations/0013_add_two_factor_table.sql")
    const migrationSQL = readFileSync(migrationPath, "utf-8")

    // Execute migration
    await client.unsafe(migrationSQL)

    console.log("✅ Two-factor migration completed successfully!")
    console.log("   - Created 'two_factor' table")
    console.log("   - Added 'two_factor_enabled' column to 'user' table (if not present)")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
