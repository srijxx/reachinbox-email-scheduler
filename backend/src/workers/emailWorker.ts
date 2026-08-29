/**
 * BullMQ Email Worker
 *
 * This file can be run as a standalone process: `npm run worker`
 * It can also be imported and started from server.ts.
 *
 * Concurrency: Controlled by WORKER_CONCURRENCY env variable.
 *
 * Minimum delay trade-off:
 *   When WORKER_CONCURRENCY > 1, multiple emails can be sent simultaneously,
 *   which technically violates a strict sequential minimum-delay requirement.
 *   We enforce MIN_EMAIL_DELAY_MS as a per-email processing lock in Redis,
 *   using a sender-specific last-sent timestamp. This means:
 *   - With concurrency=1: strict sequential delay is honored.
 *   - With concurrency>1: different recipients of the same sender still wait
 *     MIN_EMAIL_DELAY_MS from the previous send of that sender. Emails to
 *     different senders are not delayed by each other.
 *   This is documented as the chosen trade-off.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Worker, Job } from 'bullmq';
import { redis, redisClient } from '../config/redis';
import { prisma } from '../config/database';
import { EmailJobData } from '../types';
import { EMAIL_QUEUE_NAME, rescheduleEmailJob } from '../queues/emailQueue';
import { sendEmail } from '../services/emailService';
import { indexEmail, updateEmailDocument } from '../services/elasticsearchService';
import { sendRateLimitNotification } from '../services/slackService';
import {
  checkAndIncrementRateLimit,
  getNextHourStart,
  markNotificationSent,
} from '../utils/rateLimiter';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { EmailStatus } from '@prisma/client';

const MIN_DELAY_MS = env.MIN_EMAIL_DELAY_MS;
const MAX_PER_HOUR = env.MAX_EMAILS_PER_HOUR;

/**
 * Enforces minimum delay between emails from the same sender.
 * Uses a Redis timestamp per sender to track last-send time.
 * If not enough time has elapsed, sleeps for the remainder.
 */
async function enforceMinimumDelay(sender: string): Promise<void> {
  if (MIN_DELAY_MS <= 0) return;

  const key = `email-last-sent:${sender}`;
  const lastSentStr = await redisClient.get(key);

  if (lastSentStr) {
    const lastSent = parseInt(lastSentStr, 10);
    const elapsed = Date.now() - lastSent;
    const remaining = MIN_DELAY_MS - elapsed;

    if (remaining > 0) {
      logger.debug('Enforcing minimum delay', { sender, remainingMs: remaining });
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  // Record current send time
  await redisClient.set(key, Date.now().toString(), 'EX', 3600);
}

/**
 * Main job processor.
 *
 * Status machine:
 *   scheduled → processing → sent
 *                          → failed
 *   scheduled → rescheduled (rate limited, scheduledAt updated, new BullMQ job)
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;
  logger.info('Job received', { jobId: job.id, emailId });

  // 1. Load email from MySQL — authoritative source of truth
  const email = await prisma.email.findUnique({ where: { id: emailId } });

  if (!email) {
    logger.warn('Email record not found, skipping', { emailId });
    return;
  }

  // 2. Idempotency check — never re-send an already-sent email
  if (email.status === EmailStatus.sent) {
    logger.info('Email already sent, skipping (idempotency)', { emailId });
    return;
  }

  if (email.status === EmailStatus.failed) {
    logger.info('Email previously failed, skipping', { emailId });
    return;
  }

  // 3. Rate limit check — Redis-backed, atomic, per-sender
  const rateLimitResult = await checkAndIncrementRateLimit(email.sender, MAX_PER_HOUR);

  if (!rateLimitResult.allowed) {
    logger.info('Rate limit reached, rescheduling', {
      emailId,
      sender: email.sender,
      limit: MAX_PER_HOUR,
    });

    // Reschedule to next hour
    const nextHour = getNextHourStart();
    const newJobId = await rescheduleEmailJob(emailId, nextHour);

    // Update MySQL scheduledAt and bullJobId
    await prisma.email.update({
      where: { id: emailId },
      data: {
        scheduledAt: nextHour,
        bullJobId: newJobId,
        status: EmailStatus.scheduled,
        updatedAt: new Date(),
      },
    });

    // Update Elasticsearch
    await updateEmailDocument(emailId, {
      scheduledAt: nextHour.toISOString(),
      status: EmailStatus.scheduled,
    });

    // Send Slack notification (at most once per sender per hour window)
    const isFirstNotification = await markNotificationSent(email.sender);
    if (isFirstNotification) {
      // Find the user who owns this email to get Slack connection
      await sendRateLimitNotification(
        email.userId,
        email.sender,
        MAX_PER_HOUR,
        rateLimitResult.currentCount
      );
    }

    return;
  }

  // 4. Mark as processing (optimistic lock)
  await prisma.email.update({
    where: { id: emailId },
    data: { status: EmailStatus.processing, updatedAt: new Date() },
  });

  // 5. Enforce minimum send delay for this sender
  await enforceMinimumDelay(email.sender);

  // 6. Attempt to send via Ethereal SMTP
  try {
    const result = await sendEmail({
      from: email.sender,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });

    // 7. Mark sent, store preview URL and sentAt
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.sent,
        sentAt: new Date(),
        etherealPreviewUrl: result.previewUrl,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    logger.info('Email sent successfully', {
      emailId,
      to: email.recipient,
      previewUrl: result.previewUrl,
    });

    // 8. Update Elasticsearch
    await indexEmail(updatedEmail);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Email send failed', { emailId, error: errorMessage });

    // 9. Mark as failed
    const failedEmail = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.failed,
        errorMessage,
        updatedAt: new Date(),
      },
    });

    // Update Elasticsearch
    await updateEmailDocument(emailId, {
      status: EmailStatus.failed,
    });

    // Re-throw to let BullMQ handle retries (up to configured attempts)
    throw new Error(`Email send failed: ${errorMessage}`);
  }
}

// Create the worker
export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redis,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on('ready', () => {
  logger.info('Email worker started', {
    concurrency: env.WORKER_CONCURRENCY,
    minDelayMs: MIN_DELAY_MS,
    maxPerHour: MAX_PER_HOUR,
  });
});

emailWorker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id, emailId: job.data.emailId });
});

emailWorker.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job?.id,
    emailId: job?.data.emailId,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
});

emailWorker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down email worker...');
  await emailWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// If run directly (not imported)
if (require.main === module) {
  logger.info('Starting email worker process');
}
