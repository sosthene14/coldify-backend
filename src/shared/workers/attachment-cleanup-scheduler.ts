import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";

// Queue for attachment cleanup
const attachmentCleanupQueue = new Queue("attachment-cleanup", {
  connection: redisConnection,
});

// Schedule cleanup to run every hour
async function scheduleAttachmentCleanup() {
  // Remove any existing repeatable jobs
  const repeatableJobs = await attachmentCleanupQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await attachmentCleanupQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job - runs every hour
  await attachmentCleanupQueue.add(
    "cleanup",
    {},
    {
      repeat: {
        pattern: "0 * * * *", // Every hour at minute 0
      },
    }
  );

  console.log("⏰ Attachment cleanup scheduled to run every hour");
}

// Initialize scheduler
scheduleAttachmentCleanup().catch((error) => {
  console.error("Failed to schedule attachment cleanup:", error);
});

export { attachmentCleanupQueue };
