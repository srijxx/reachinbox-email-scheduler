import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import { EmailJobData } from '../types';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'email-scheduler';

/**
 * BullMQ queue for email scheduling.
 *
 * Why BullMQ + Redis:
 * - Delayed jobs are stored in Redis sorted sets (score = timestamp).
 * - They survive process restarts because state is in Redis, not in-memory.
 * - Workers pick up jobs when the delay expires, regardless of which process
 *   instance picks them up.
 * - We do NOT recreate jobs from MySQL on restart — BullMQ/Redis owns the
 *   scheduling state. MySQL is the authoritative record of email data.
 */
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000,   // Keep last 1000 completed jobs in Bull Board
      age: 86400,    // Remove completed jobs after 24h
    },
    removeOnFail: {
      count: 500,    // Keep last 500 failed jobs for inspection
    },
  },
});

emailQueue.on('error', (err) => {
  logger.error('Email queue error', { error: err.message });
});

/**
 * Adds a delayed email job to the queue.
 * @param emailId - UUID of the Email record in MySQL
 * @param delayMs - milliseconds from now until the job should execute
 * @returns BullMQ job ID
 */
export async function scheduleEmailJob(
  emailId: string,
  delayMs: number
): Promise<string> {
  const job = await emailQueue.add(
    'send-email',
    { emailId },
    {
      delay: delayMs,
      jobId: `email-${emailId}`, // Deterministic job ID for idempotency
    }
  );
  logger.info('Email job scheduled', { emailId, delayMs, jobId: job.id });
  return job.id ?? emailId;
}

/**
 * Reschedules a job for the next available hour window.
 * Removes the old delayed job and creates a new one with updated delay.
 */
export async function rescheduleEmailJob(
  emailId: string,
  newScheduledAt: Date
): Promise<string> {
  const oldJobId = `email-${emailId}`;

  try {
    const existingJob = await emailQueue.getJob(oldJobId);
    if (existingJob) {
      await existingJob.remove();
      logger.info('Removed old delayed job for reschedule', { emailId, oldJobId });
    }
  } catch (err) {
    logger.warn('Could not remove old job (may not exist)', { emailId, err });
  }

  const delayMs = Math.max(0, newScheduledAt.getTime() - Date.now());
  const job = await emailQueue.add(
    'send-email',
    { emailId },
    {
      delay: delayMs,
      jobId: oldJobId,
    }
  );

  logger.info('Email job rescheduled', { emailId, newScheduledAt, delayMs, jobId: job.id });
  return job.id ?? emailId;
}
