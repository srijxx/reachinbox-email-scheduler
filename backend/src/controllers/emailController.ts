import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { scheduleEmailJob } from '../queues/emailQueue';
import { indexEmail } from '../services/elasticsearchService';
import { searchEmails } from '../services/elasticsearchService';
import { createManyEmails } from '../repositories/emailRepository';
import { getSentEmails, getScheduledEmails } from '../repositories/emailRepository';
import { filterValidEmails } from '../utils/emailValidator';
import { logger } from '../utils/logger';

// Validation schema
const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.string())
    .min(1, 'At least one recipient is required'),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'startTime must be a valid ISO date string',
  }),
  delayBetweenEmails: z
    .number()
    .int()
    .min(0, 'delayBetweenEmails must be >= 0')
    .max(3_600_000, 'delayBetweenEmails must be <= 1 hour in ms'),
  hourlyLimit: z
    .number()
    .int()
    .min(1, 'hourlyLimit must be >= 1')
    .max(10_000),
  sender: z.string().email('sender must be a valid email address'),
});

export async function scheduleEmails(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.user as any).id;

    // Validate request body
    const parseResult = scheduleEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const { subject, body, recipients, startTime, delayBetweenEmails, hourlyLimit, sender } =
      parseResult.data;

    // Filter and validate email addresses on the backend too
    const validRecipients = filterValidEmails(recipients);
    if (validRecipients.length === 0) {
      res.status(400).json({ message: 'No valid recipient email addresses provided' });
      return;
    }

    const startDate = new Date(startTime);

    // startTime must be in the future (allow 30s grace for clock skew)
    if (startDate.getTime() < Date.now() - 30_000) {
      res.status(400).json({ message: 'startTime must be in the future' });
      return;
    }

    logger.info('Scheduling emails', {
      userId,
      recipientCount: validRecipients.length,
      sender,
      startTime,
    });

    // Build email records and jobs
    const emailRecords: Parameters<typeof createManyEmails>[0] = [];
    const jobSchedules: Array<{ emailId: string; delayMs: number }> = [];

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];
      const scheduledAt = new Date(startDate.getTime() + delayBetweenEmails * i);
      const emailId = uuidv4();
      const idempotencyKey = `${userId}:${recipient}:${sender}:${scheduledAt.getTime()}:${uuidv4()}`;
      const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());

      emailRecords.push({
        recipient,
        subject,
        body,
        sender,
        scheduledAt,
        idempotencyKey,
        bullJobId: `email-${emailId}`,
        userId,
      });

      jobSchedules.push({ emailId, delayMs });
    }

    // Insert all email records in bulk (skipDuplicates for idempotency)
    // We need the actual IDs, so we create them individually via transaction
    const createdEmails = await prisma.$transaction(
      emailRecords.map((record) =>
        prisma.email.create({ data: record })
      )
    );

    logger.info('Email records created', { count: createdEmails.length, userId });

    // Schedule BullMQ delayed jobs and index in Elasticsearch
    const jobPromises = createdEmails.map(async (email, idx) => {
      const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());
      const jobId = await scheduleEmailJob(email.id, delayMs);

      // Update bull job ID in MySQL
      await prisma.email.update({
        where: { id: email.id },
        data: { bullJobId: jobId },
      });

      // Index in Elasticsearch (non-blocking failures)
      await indexEmail({ ...email, bullJobId: jobId });
    });

    await Promise.allSettled(jobPromises);

    logger.info('All email jobs scheduled', {
      count: createdEmails.length,
      userId,
    });

    res.status(201).json({
      message: `${createdEmails.length} emails scheduled successfully`,
      scheduled: createdEmails.length,
      startTime: startDate.toISOString(),
    });
  } catch (error) {
    logger.error('Schedule emails failed', { error });
    res.status(500).json({ message: 'Failed to schedule emails' });
  }
}

export async function getScheduledEmailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.user as any).id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    const result = await getScheduledEmails(userId, page, pageSize);
    res.json(result);
  } catch (error) {
    logger.error('Get scheduled emails failed', { error });
    res.status(500).json({ message: 'Failed to fetch scheduled emails' });
  }
}

export async function getSentEmailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.user as any).id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    const result = await getSentEmails(userId, page, pageSize);
    res.json(result);
  } catch (error) {
    logger.error('Get sent emails failed', { error });
    res.status(500).json({ message: 'Failed to fetch sent emails' });
  }
}

export async function searchEmailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req.user as any).id;
    const q = (req.query.q as string) ?? '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    if (!q.trim()) {
      res.status(400).json({ message: 'Search query (q) is required' });
      return;
    }

    const result = await searchEmails({ query: q, userId, page, pageSize });
    res.json({
      data: result.emails,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
    });
  } catch (error) {
    logger.error('Search emails failed', { error });
    res.status(500).json({ message: 'Search failed' });
  }
}
