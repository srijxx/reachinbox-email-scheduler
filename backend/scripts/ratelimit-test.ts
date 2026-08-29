/**
 * Rate-limit test script.
 * Inserts 7 email records directly into MySQL and enqueues them
 * into BullMQ — same as what the API does — to trigger the rate
 * limit (MAX_EMAILS_PER_HOUR=5) and verify Slack notification.
 *
 * Run: npx ts-node scripts/ratelimit-test.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../src/config/database';
import { emailQueue } from '../src/queues/emailQueue';
import { redisClient } from '../src/config/redis';

const SENDER = 'ratelimit-test@reachinbox.local';
const USER_ID = 'YOUR_USER_ID_HERE'; // real Google-authenticated user
const NUM_EMAILS = 7;
const DELAY_BETWEEN_MS = 3000;
const START_OFFSET_MS = 6000; // start 6 seconds from now

async function main() {
  console.log('=== Rate Limit Test ===');
  console.log(`Scheduling ${NUM_EMAILS} emails from ${SENDER}`);
  console.log(`MAX_EMAILS_PER_HOUR = ${process.env.MAX_EMAILS_PER_HOUR}`);

  // Clear stale rate-limit keys for clean test
  const hourWindow = new Date().toISOString().slice(0, 13);
  await redisClient.del(`email-rate:${SENDER}:${hourWindow}`);
  await redisClient.del(`email-rate-notified:${SENDER}:${hourWindow}`);
  await redisClient.del(`email-last-sent:${SENDER}`);
  console.log('Cleared stale Redis rate-limit keys');

  const startTime = Date.now() + START_OFFSET_MS;
  const createdIds: string[] = [];

  for (let i = 0; i < NUM_EMAILS; i++) {
    const emailId = uuidv4();
    const scheduledAt = new Date(startTime + DELAY_BETWEEN_MS * i);
    const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());

    const email = await prisma.email.create({
      data: {
        id: emailId,
        recipient: `ratelimit-recipient-${i}@test.example`,
        subject: `Rate Limit Test Email ${i + 1} of ${NUM_EMAILS}`,
        body: `<p>Rate limit test email #${i + 1}. This tests whether the worker correctly reschedules emails when the hourly limit is reached.</p>`,
        sender: SENDER,
        scheduledAt,
        status: 'scheduled',
        idempotencyKey: `ratelimit-test-${uuidv4()}`,
        bullJobId: `email-${emailId}`,
        userId: USER_ID,
      },
    });

    // Enqueue BullMQ delayed job
    const job = await emailQueue.add(
      'send-email',
      { emailId },
      {
        delay: delayMs,
        jobId: `email-${emailId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    console.log(`[${i + 1}/${NUM_EMAILS}] Scheduled: ${emailId} | delay: ${delayMs}ms | jobId: ${job.id}`);
    createdIds.push(emailId);
  }

  console.log(`\n${NUM_EMAILS} emails scheduled. Worker will process them in ~${START_OFFSET_MS / 1000}s.`);
  console.log('Watch the worker logs for:');
  console.log('  - Emails 1-5: "Email sent successfully"');
  console.log('  - Emails 6-7: "Rate limit reached, rescheduling"');
  console.log('  - Slack: "Slack notification sent successfully"');
  console.log('\nEmail IDs:', createdIds.join(', '));

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
