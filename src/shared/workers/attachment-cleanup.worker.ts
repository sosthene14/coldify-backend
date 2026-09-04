import { Worker } from "bullmq"
import { attachmentUploadService } from "../../modules/mailbox/attachment-upload.service"
import { redisConnection } from "../lib/redis"

// Worker to clean up expired attachments every hour
const attachmentCleanupWorker = new Worker(
  "attachment-cleanup",
  async (_job) => {
 
    try {
      const result = await attachmentUploadService.cleanupExpiredAttachments()

 
      return result
    } catch (error) {
      console.error("Attachment cleanup worker error:", error)
      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Only one cleanup job at a time
  },
)

attachmentCleanupWorker.on("completed", (job) => {
  console.log(`Attachment cleanup job ${job.id} completed`)
})

attachmentCleanupWorker.on("failed", (job, err) => {
  console.error(`Attachment cleanup job ${job?.id} failed:`, err)
})

console.log("📦 Attachment cleanup worker started")

export { attachmentCleanupWorker }
