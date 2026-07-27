// src/lib/redis.ts
import { Redis } from "ioredis";

export const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // requis par BullMQ
});