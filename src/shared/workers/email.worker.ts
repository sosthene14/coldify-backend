// src/lib/queues/email.worker.ts
import { Worker } from "bullmq"
import { Resend } from "resend"
import type { EmailJobData } from "../lib/queues/email.queue"
import { redisConnection } from "../lib/redis"

const resend = new Resend(process.env.RESEND_API_KEY || "")

export const emailWorker = new Worker<EmailJobData>(
  "emails",
  async (job) => {
    const { to, subject, html } = job.data

    const { error } = await resend.emails.send({
      from: "So-mails <onboarding@rocolis.com>", // domaine partagé Resend en dev
      to,
      subject,
      html,
    })

    if (error) throw new Error(error.message)
  },
  { connection: redisConnection, concurrency: 5 },
)

emailWorker.on("completed", (job) => {
  console.log(`✅ Email envoyé à ${job.data.to}`)
})

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Échec envoi email à ${job?.data.to}:`, err.message)
})
