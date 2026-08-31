// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/db/schema",
  out: "./src/shared/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,


  },  tablesFilter: [
    "!campaign_daily_stat_cagg",
    "!member_daily_stat_cagg",
  ]
});