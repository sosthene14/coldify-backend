// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, {
  // Force UTF-8 encoding
  prepare: false,
  onnotice: () => {},
  connection: {
    client_encoding: 'UTF8',
  },
});

export const db = drizzle(client, { schema });