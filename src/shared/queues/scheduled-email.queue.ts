import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";

export interface ScheduledEmailJobData {
  scheduledEmailId: string;
  organizationId: string;
  mailboxId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  templateId?: string; // Add templateId for tracking
  attachments?: Array<{
    filename: string;
    mimeType: string;
    objectKey: string;
    size: number;
  }>;
}

export const scheduledEmailQueue = new Queue<ScheduledEmailJobData>(
  "scheduled-emails",
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60000, // 1 minute
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  }
);

export async function addScheduledEmail(
  data: ScheduledEmailJobData,
  scheduledAt: Date
): Promise<string> {
  const delay = scheduledAt.getTime() - Date.now();

  if (delay < 0) {
    throw new Error("Scheduled time must be in the future");
  }

  const job = await scheduledEmailQueue.add(
    "send-scheduled-email",
    data,
    {
      delay,
      jobId: `scheduled-${data.scheduledEmailId}`,
    }
  );

  return job.id!;
}

export async function cancelScheduledEmail(jobId: string): Promise<boolean> {
  const job = await scheduledEmailQueue.getJob(jobId);
  
  if (!job) {
    return false;
  }

  await job.remove();
  return true;
}
