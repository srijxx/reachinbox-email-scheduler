import { prisma } from '../config/database';
import { Email, EmailStatus } from '@prisma/client';
import { PaginatedResponse } from '../types';

export interface CreateEmailData {
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  scheduledAt: Date;
  idempotencyKey: string;
  bullJobId: string;
  userId: string;
}

export async function createEmail(data: CreateEmailData): Promise<Email> {
  return prisma.email.create({ data });
}

export async function createManyEmails(data: CreateEmailData[]): Promise<number> {
  const result = await prisma.email.createMany({
    data,
    skipDuplicates: true,
  });
  return result.count;
}

export async function getEmailById(id: string, userId?: string): Promise<Email | null> {
  return prisma.email.findFirst({
    where: userId ? { id, userId } : { id },
  });
}

export async function updateEmailStatus(
  id: string,
  status: EmailStatus,
  extra?: Partial<Pick<Email, 'sentAt' | 'errorMessage' | 'etherealPreviewUrl' | 'scheduledAt' | 'bullJobId'>>
): Promise<Email> {
  return prisma.email.update({
    where: { id },
    data: {
      status,
      updatedAt: new Date(),
      ...extra,
    },
  });
}

export async function getScheduledEmails(
  userId: string,
  page: number,
  pageSize: number
): Promise<PaginatedResponse<Email>> {
  const where = {
    userId,
    status: { in: [EmailStatus.scheduled, EmailStatus.processing] as EmailStatus[] },
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.email.count({ where }),
  ]);

  return {
    data: emails,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getSentEmails(
  userId: string,
  page: number,
  pageSize: number
): Promise<PaginatedResponse<Email>> {
  const where = {
    userId,
    status: { in: [EmailStatus.sent, EmailStatus.failed] as EmailStatus[] },
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.email.count({ where }),
  ]);

  return {
    data: emails,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function markEmailProcessing(id: string): Promise<Email> {
  return prisma.email.update({
    where: { id },
    data: { status: EmailStatus.processing, updatedAt: new Date() },
  });
}
