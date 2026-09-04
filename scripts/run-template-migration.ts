// Script to run template_id migration for scheduled_emails

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://somails:somails_dev_password@localhost:5432/somails";

async function runMigration() {
  const client = postgres(DATABASE_URL)

  try {
    console.log("🔄 Running scheduled_emails template_id migration...")

    // Read migration file
    const migrationPath = join(__dirname, "../migrations/007_add_template_id_to_scheduled_emails.sql")
    const migrationSQL = readFileSync(migrationPath, "utf-8")

    // Execute migration
    await client.unsafe(migrationSQL)

    console.log("✅ Migration completed successfully!")
    console.log("📋 Added template_id column to scheduled_emails table")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
