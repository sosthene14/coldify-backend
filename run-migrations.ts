import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL || ""

  console.log("🔄 Connexion a la base de donnees...")
  const migrationClient = postgres(connectionString, { max: 1 })

  const db = drizzle(migrationClient)

  console.log("📦 Application des migrations Drizzle...")
  await migrate(db, { migrationsFolder: "./src/shared/db/migrations" })

  console.log("✅ Migrations Drizzle appliquees avec succes!")

  await migrationClient.end()
  process.exit(0)
}

runMigrations().catch((err) => {
  console.error("❌ Erreur lors de application des migrations:", err)
  process.exit(1)
})
