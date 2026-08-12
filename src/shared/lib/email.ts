// src/lib/email.ts
import { emailQueue } from "./queues/email.queue";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  await emailQueue.add("send-email", { to, subject, html });
}