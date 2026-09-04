// src/lib/queues/email.queue.ts
import { Queue } from "bullmq"
import { redisConnection } from "../redis"

export type EmailJobData = {
  to: string
  subject: string
  html: string
}

export const emailQueue = new Queue<EmailJobData>("emails", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
})
